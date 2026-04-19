import Foundation
@testable import SweepsReliefHelperCore
import Testing

@Test
func hostsDeterministic() throws {
    let json = """
    {"hash":"ab","policy":{"affiliate_domains":[],"domain_patterns":[],"domains":["b.com","a.com"],"funnel_domains":[],"generated_at":"2026-01-01T00:00:00Z","heuristics":{"keyword_weights":{},"keywords":[],"page_indicators":[],"title_indicators":[]},"metadata":{},"payment_indicators":[],"schema_version":"1.0","sources":[],"version":"1"},"signature_b64":"eA==","signing_scheme":"ed25519"}
    """.data(using: .utf8)!
    let r1 = try HostsRenderer.render(policyJSONData: json)
    let r2 = try HostsRenderer.render(policyJSONData: json)
    #expect(r1 == r2)
    #expect(r1.contains("0.0.0.0\ta.com"))
    #expect(r1.contains("0.0.0.0\twww.a.com"))
}
