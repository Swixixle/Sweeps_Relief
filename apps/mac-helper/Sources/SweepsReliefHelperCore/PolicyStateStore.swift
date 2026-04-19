import Foundation

public struct AppliedState: Codable, Sendable {
    public var appliedPolicyHash: String?
    public var appliedPolicyVersion: String?
}

public enum PolicyStateStore {
    public static func readAppliedHash(at url: URL) -> String? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return try? String(contentsOf: url, encoding: .utf8)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public static func writeAppliedHash(_ hash: String, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try hash.write(to: url, atomically: true, encoding: .utf8)
    }

    public static func readAppliedVersion(at url: URL) -> String? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return try? String(contentsOf: url, encoding: .utf8)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public static func writeAppliedVersion(_ version: String, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try version.write(to: url, atomically: true, encoding: .utf8)
    }

    public static func writePolicyCache(_ data: Data, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: url, options: .atomic)
    }

    public struct LastRun: Codable {
        public var ts: String
        public var outcome: String
    }

    public static func writeLastRun(_ run: LastRun, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let enc = JSONEncoder()
        enc.outputFormatting = [.sortedKeys]
        let data = try enc.encode(run)
        try data.write(to: url, options: .atomic)
    }
}
