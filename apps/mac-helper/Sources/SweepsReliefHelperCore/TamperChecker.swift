import Foundation

public struct TamperReport: Sendable {
    public var issues: [String]
    public var isClean: Bool { issues.isEmpty }
}

/// Drift / tamper signaling — not full anti-root guarantees.
public enum TamperChecker {
    public static func check(
        expectedPolicyData: Data,
        hostsContent: String?,
        appliedHashFromDisk: String?,
        expectedContentHash: String
    ) -> TamperReport {
        var issues: [String] = []
        if appliedHashFromDisk != expectedContentHash {
            issues.append("applied_hash_mismatch")
        }
        guard let hosts = hostsContent else {
            issues.append("hosts_file_missing")
            return TamperReport(issues: issues)
        }
        let expectedHosts: String
        do {
            expectedHosts = try HostsRenderer.render(policyJSONData: expectedPolicyData)
        } catch {
            issues.append("hosts_render_failed")
            return TamperReport(issues: issues)
        }
        if hosts != expectedHosts {
            issues.append("hosts_content_drift")
        }
        return TamperReport(issues: issues)
    }
}
