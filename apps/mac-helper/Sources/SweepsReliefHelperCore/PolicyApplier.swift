import Foundation

public struct ApplyResult: Sendable {
    public var wroteHosts: Bool
    public var message: String
}

/// Writes generated hosts to a managed path. Privileged install into `/etc/hosts` is out of scope for v1.
public enum PolicyApplier {
    /// Always writes `hosts` string to configured `hosts_output_path` (user-writable).
    public static func applyDryRun(hosts: String, to outputURL: URL) throws -> ApplyResult {
        try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try hosts.write(to: outputURL, atomically: true, encoding: .utf8)
        return ApplyResult(wroteHosts: true, message: "wrote_managed_hosts")
    }

    /// Placeholder for future merge into system hosts — does not write outside managed path in v1.
    public static func applyScaffoldPrivilegedInstall(hosts: String, managedURL: URL) throws -> ApplyResult {
        try applyDryRun(hosts: hosts, to: managedURL)
    }
}
