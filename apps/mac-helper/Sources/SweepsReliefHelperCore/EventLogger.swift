import Foundation

/// JSONL append-only events with hash chain aligned with Python `chain_event(prev_hash, event_dict)`.
public enum EventLogger {
    /// Same as Python `chain_event`: SHA-256 hex of canonical `{"prev_hash":..., "event": ...}`.
    public static func chainHash(prevHash: String?, event: [String: Any]) throws -> String {
        let payload: [String: Any] = [
            "prev_hash": prevHash ?? "",
            "event": event,
        ]
        let data = try CanonicalJSON.data(from: payload)
        return Hashing.sha256Hex(data)
    }

    public static func appendLine(
        logURL: URL,
        deviceId: String,
        type: String,
        target: String = "",
        classification: String = "",
        context: [String: Any] = [:]
    ) throws {
        try FileManager.default.createDirectory(at: logURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let lastHash = try readLastHash(logURL)
        let ts = iso8601Z()
        var event: [String: Any] = [
            "event_id": UUID().uuidString,
            "ts": ts,
            "device_id": deviceId,
            "event_type": type,
            "target": target,
            "classification": classification,
            "context": context,
            "prev_hash": lastHash ?? "",
        ]
        let h = try chainHash(prevHash: lastHash, event: event)
        event["hash"] = h
        let lineObj = event
        let data = try JSONSerialization.data(withJSONObject: lineObj, options: [.sortedKeys])
        guard var line = String(data: data, encoding: .utf8) else { return }
        line.append("\n")
        guard let lineData = line.data(using: .utf8) else { return }
        if FileManager.default.fileExists(atPath: logURL.path) {
            let h = try FileHandle(forWritingTo: logURL)
            defer { try? h.close() }
            try h.seekToEnd()
            try h.write(contentsOf: lineData)
        } else {
            try lineData.write(to: logURL, options: .atomic)
        }
    }

    private static func readLastHash(_ logURL: URL) throws -> String? {
        guard FileManager.default.fileExists(atPath: logURL.path) else { return nil }
        let content = try String(contentsOf: logURL, encoding: .utf8)
        let lines = content.split(separator: "\n", omittingEmptySubsequences: true)
        guard let lastLine = lines.last else { return nil }
        let data = Data(lastLine.utf8)
        let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        return obj?["hash"] as? String
    }

    private static func iso8601Z() -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var s = f.string(from: Date())
        if s.hasSuffix("+00:00") {
            s = String(s.dropLast(6)) + "Z"
        }
        return s
    }
}
