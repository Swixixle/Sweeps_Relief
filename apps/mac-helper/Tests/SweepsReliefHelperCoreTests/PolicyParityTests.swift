import Foundation
@testable import SweepsReliefHelperCore
import Testing

/// Parity with Python `policy_body_for_signing` + artifact `hash` field.
@Test
func policyJsonHashMatchesArtifactField() throws {
    // .../apps/mac-helper/Tests/.../PolicyParityTests.swift → repo root is five levels up
    let repoRoot = URL(fileURLWithPath: #file)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
    let url = repoRoot.appendingPathComponent("data/published/policy.json")
    let data = try Data(contentsOf: url)
    let h = try PolicyVerifier.policyContentHash(policyJSONData: data)
    let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    let expected = obj?["hash"] as? String
    #expect(h == expected)
}
