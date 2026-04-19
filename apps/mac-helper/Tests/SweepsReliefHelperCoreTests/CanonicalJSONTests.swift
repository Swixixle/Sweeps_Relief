import Foundation
@testable import SweepsReliefHelperCore
import Testing

@Test
func stableKeyOrder() throws {
    let a: [String: Any] = ["z": 1, "a": ["b": 2, "c": 3]]
    let b: [String: Any] = ["a": ["c": 3, "b": 2], "z": 1]
    let sa = try CanonicalJSON.string(from: a)
    let sb = try CanonicalJSON.string(from: b)
    #expect(sa == sb)
}

@Test
func hashChainShape() throws {
    let event: [String: Any] = [
        "event_id": "x",
        "ts": "2026-01-01T00:00:00Z",
        "device_id": "d",
        "event_type": "test",
        "target": "",
        "classification": "",
        "context": [:] as [String: Any],
        "prev_hash": "",
    ]
    let payload: [String: Any] = ["prev_hash": "", "event": event]
    let data = try CanonicalJSON.data(from: payload)
    let hex = Hashing.sha256Hex(data)
    #expect(hex.count == 64)
}
