import Foundation
@testable import SweepsReliefHelperCore
import Testing

// MARK: - Client digest (must reject before XPC — no helper required)

@Test
func privilegedHelperClientRejectsDigestMismatch() async {
    let hosts = "127.0.0.1\tok.example\n"
    let other = "0.0.0.0\tother.example\n"
    let wrongDigest = Hashing.sha256Hex(Data(other.utf8))

    let result = await PrivilegedHelperClient.shared.applyVerifiedHosts(hosts, expectedDigest: wrongDigest)
    #expect(result.success == false)
    #expect(result.error == .invalidDigest)
}

// MARK: - Policy applier contract

@Test
func privilegedRequiredRequiresDigest() async throws {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("hosts-\(UUID().uuidString)")
    var sawMissingDigest = false
    do {
        _ = try await PolicyApplier.apply(
            hosts: "127.0.0.1\ta.com",
            mode: .privilegedRequired,
            to: url,
            expectedDigest: nil
        )
    } catch let e as PolicyApplierError {
        if case .missingDigest = e { sawMissingDigest = true }
        else { throw e }
    }
    #expect(sawMissingDigest)
}

// MARK: - Line validation (privileged helper refusal cases; no disk I/O)

@Test
func privilegedHostsValidationAcceptsWellFormedBlock() {
    let block = """
    # Sweeps Relief
    127.0.0.1\tallowed.com www.allowed.com
    0.0.0.0\tblocked.net
    """
    #expect(PrivilegedHostsLineValidation.validationReason(for: block) == nil)
}

@Test
func privilegedHostsValidationRejectsBadIP() {
    let bad = "999.999.999.999\tno.com\n"
    let reason = PrivilegedHostsLineValidation.validationReason(for: bad)
    #expect(reason != nil)
    #expect(reason!.contains("invalid IP"))
}

@Test
func privilegedHostsValidationRejectsSingleColumnLine() {
    let bad = "onlyhostname\n"
    let reason = PrivilegedHostsLineValidation.validationReason(for: bad)
    #expect(reason != nil)
    #expect(reason!.contains("invalid format"))
}

@Test
func privilegedHostsValidationRejectsInvalidHostname() {
    let bad = "127.0.0.1\tbad_host!name.com\n"
    let reason = PrivilegedHostsLineValidation.validationReason(for: bad)
    #expect(reason != nil)
    #expect(reason!.contains("invalid hostname"))
}

// MARK: - /etc/hosts managed section merge (no real disk I/O)

@Test
func mergeEmptyEtcHostsProducesWrappedBlock() {
    let inner = "0.0.0.0\tx.example\n"
    guard case let .success(merged) = PrivilegedEtcHostsMerge.mergeManagedSection(intoExisting: "", managedInnerContent: inner) else {
        Issue.record("expected success")
        return
    }
    #expect(merged.contains(PrivilegedEtcHostsMerge.beginMarker))
    #expect(merged.contains(PrivilegedEtcHostsMerge.endMarker))
    #expect(merged.contains("0.0.0.0\tx.example"))
}

@Test
func mergeAppendsWhenNoMarkers() {
    let existing = "127.0.0.1\tlocalhost\n"
    let inner = "0.0.0.0\tb.com\n"
    guard case let .success(merged) = PrivilegedEtcHostsMerge.mergeManagedSection(intoExisting: existing, managedInnerContent: inner) else {
        Issue.record("expected success")
        return
    }
    #expect(merged.hasPrefix("127.0.0.1\tlocalhost"))
    #expect(merged.contains(PrivilegedEtcHostsMerge.beginMarker))
    #expect(merged.contains("0.0.0.0\tb.com"))
}

@Test
func mergeReplacesManagedSectionPreservesUserLines() {
    let innerV1 = "0.0.0.0\ta.example\n"
    let innerV2 = "0.0.0.0\tb.example\n"
    guard case let .success(first) = PrivilegedEtcHostsMerge.mergeManagedSection(
        intoExisting: "10.0.0.1\tpinned.local\n",
        managedInnerContent: innerV1
    ) else {
        Issue.record("expected success")
        return
    }
    #expect(first.contains("pinned.local"))
    #expect(first.contains("a.example"))

    guard case let .success(second) = PrivilegedEtcHostsMerge.mergeManagedSection(intoExisting: first, managedInnerContent: innerV2) else {
        Issue.record("expected success")
        return
    }
    #expect(second.contains("pinned.local"))
    #expect(second.contains("b.example"))
    #expect(!second.contains("a.example"))
}

@Test
func mergeOrphanBeginFails() {
    let bad =
        """
        \(PrivilegedEtcHostsMerge.beginMarker)
        127.0.0.1\twoops
        """
    let r = PrivilegedEtcHostsMerge.mergeManagedSection(intoExisting: bad, managedInnerContent: "0.0.0.0\tx.com\n")
    guard case let .failure(err) = r else {
        Issue.record("expected failure")
        return
    }
    #expect(err == .orphanBeginMarker)
}

@Test
func mergeOrphanEndFails() {
    let bad = "127.0.0.1\tl\n\(PrivilegedEtcHostsMerge.endMarker)\n"
    let r = PrivilegedEtcHostsMerge.mergeManagedSection(intoExisting: bad, managedInnerContent: "0.0.0.0\tx.com\n")
    guard case let .failure(err) = r else {
        Issue.record("expected failure")
        return
    }
    #expect(err == .orphanEndMarker)
}
