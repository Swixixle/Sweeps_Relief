import Foundation

public struct ApplyResult: Sendable {
    public var wroteHosts: Bool
    public var message: String
    public var backupPath: String?
    public var usedPrivilegedPath: Bool

    public init(wroteHosts: Bool, message: String, backupPath: String? = nil, usedPrivilegedPath: Bool = false) {
        self.wroteHosts = wroteHosts
        self.message = message
        self.backupPath = backupPath
        self.usedPrivilegedPath = usedPrivilegedPath
    }
}

/// Policy application modes.
public enum ApplyMode: Sendable {
    /// Write to user-writable managed path only (v1 default).
    case dryRun
    /// Attempt privileged install via XPC helper; falls back to dryRun on failure.
    case privilegedWithFallback
    /// Require privileged install; fail if helper unavailable.
    case privilegedRequired
}

/// Writes generated hosts to configured paths. Supports both dry-run (user-writable)
/// and privileged paths (via XPC to root helper).
public enum PolicyApplier {
    /// Apply hosts content according to the specified mode.
    /// - Parameters:
    ///   - hosts: The hosts content to write
    ///   - mode: The application mode (dryRun, privilegedWithFallback, or privilegedRequired)
    ///   - outputURL: URL for dry-run mode writes
    ///   - expectedDigest: SHA-256 hex digest of hosts (required for privileged modes)
    /// - Returns: ApplyResult with status and details
    public static func apply(
        hosts: String,
        mode: ApplyMode,
        to outputURL: URL,
        expectedDigest: String? = nil
    ) async throws -> ApplyResult {
        switch mode {
        case .dryRun:
            return try applyDryRun(hosts: hosts, to: outputURL)

        case .privilegedWithFallback:
            // Try privileged first, fall back to dry-run
            if let digest = expectedDigest {
                let client = PrivilegedHelperClient.shared
                if await client.isHelperAvailable() {
                    let result = await client.applyVerifiedHosts(hosts, expectedDigest: digest)
                    if result.success {
                        return ApplyResult(
                            wroteHosts: true,
                            message: result.message,
                            backupPath: result.backupPath,
                            usedPrivilegedPath: true
                        )
                    }
                    // Privileged failed, fall through to dry-run
                }
            }
            // Fall back to dry-run
            var dryRunResult = try applyDryRun(hosts: hosts, to: outputURL)
            dryRunResult.message += " (privileged helper unavailable, used dry-run)"
            return dryRunResult

        case .privilegedRequired:
            guard let digest = expectedDigest else {
                throw PolicyApplierError.missingDigest
            }
            let client = PrivilegedHelperClient.shared
            guard await client.isHelperAvailable() else {
                throw PolicyApplierError.privilegedHelperUnavailable
            }
            let result = await client.applyVerifiedHosts(hosts, expectedDigest: digest)
            guard result.success else {
                throw PolicyApplierError.privilegedApplyFailed(result.message)
            }
            return ApplyResult(
                wroteHosts: true,
                message: result.message,
                backupPath: result.backupPath,
                usedPrivilegedPath: true
            )
        }
    }

    /// Always writes `hosts` string to configured `hosts_output_path` (user-writable).
    public static func applyDryRun(hosts: String, to outputURL: URL) throws -> ApplyResult {
        try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try hosts.write(to: outputURL, atomically: true, encoding: .utf8)
        return ApplyResult(wroteHosts: true, message: "wrote_managed_hosts", usedPrivilegedPath: false)
    }

    /// Deprecated: Use `apply(mode: .privilegedWithFallback, ...)` instead.
    /// Kept for backward compatibility.
    @available(*, deprecated, message: "Use apply(mode:to:expectedDigest:) instead")
    public static func applyScaffoldPrivilegedInstall(hosts: String, managedURL: URL) throws -> ApplyResult {
        try applyDryRun(hosts: hosts, to: managedURL)
    }
}

public enum PolicyApplierError: Error {
    case missingDigest
    case privilegedHelperUnavailable
    case privilegedApplyFailed(String)
}

extension PolicyApplierError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .missingDigest:
            return "Expected digest is required for privileged apply mode"
        case .privilegedHelperUnavailable:
            return "Privileged helper is not installed or not responding"
        case .privilegedApplyFailed(let message):
            return "Privileged apply failed: \(message)"
        }
    }
}
