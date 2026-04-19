import Foundation
@testable import SweepsReliefHelperCore
import Testing

@Test
func driftDetected() throws {
    let json = """
    {"hash":"x","policy":{"affiliate_domains":[],"domain_patterns":[],"domains":["evil.test"],"funnel_domains":[],"generated_at":"2026-01-01T00:00:00Z","heuristics":{"keyword_weights":{},"keywords":[],"page_indicators":[],"title_indicators":[]},"metadata":{},"payment_indicators":[],"schema_version":"1.0","sources":[],"version":"1"},"signature_b64":"eA==","signing_scheme":"ed25519"}
    """.data(using: .utf8)!
    let expectedHash = try PolicyVerifier.policyContentHash(policyJSONData: json)
    let goodHosts = try HostsRenderer.render(policyJSONData: json)
    let report = TamperChecker.check(
        expectedPolicyData: json,
        hostsContent: goodHosts + "\n# tamper",
        appliedHashFromDisk: expectedHash,
        expectedContentHash: expectedHash
    )
    #expect(report.issues.contains("hosts_content_drift"))
}
