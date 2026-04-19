import Foundation

public enum DeviceIdentity {
    /// Stable per-user device id stored at the given path (created on first use).
    public static func deviceId(file: URL) throws -> String {
        if FileManager.default.fileExists(atPath: file.path),
           let existing = try? String(contentsOf: file, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines),
           !existing.isEmpty
        {
            return existing
        }
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        let id = UUID().uuidString
        try id.write(to: file, atomically: true, encoding: .utf8)
        return id
    }
}
