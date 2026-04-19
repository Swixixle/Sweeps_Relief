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
