import Foundation

/// Errors that can occur during privileged operations.
public enum PrivilegedHelperError: Error, Sendable {
    case connectionFailed
    case communicationTimeout
    case invalidDigest
    case writeFailed(String)
    case backupFailed(String)
    case verificationFailed
    case notAuthorized
    case helperNotRunning
    case xpcError(String)
    case malformedResponse
}

/// Protocol for the privileged helper XPC interface.
/// This protocol defines what the privileged helper can do.
@objc public protocol PrivilegedHelperProtocol {
    /// Apply verified hosts content to /etc/hosts.
    /// - Parameters:
    ///   - hostsContent: The verified hosts content to write
    ///   - expectedDigest: SHA-256 hex digest of the content (must match for operation to proceed)
    ///   - reply: Callback with (success: Bool, errorMessage: String?, backupPath: String?)
    func applyVerifiedHosts(_ hostsContent: String, expectedDigest: String, reply: @escaping (Bool, String?, String?) -> Void)

    /// Verify the helper is running and responsive.
    func ping(_ reply: @escaping (Bool) -> Void)

    /// Get the helper version info.
    func version(_ reply: @escaping (String) -> Void)
}

/// Result of a privileged apply operation.
public struct PrivilegedApplyResult: Sendable {
    public var success: Bool
    public var message: String
    public var backupPath: String?
    public var error: PrivilegedHelperError?

    public init(success: Bool, message: String, backupPath: String? = nil, error: PrivilegedHelperError? = nil) {
        self.success = success
        self.message = message
        self.backupPath = backupPath
        self.error = error
    }
}

/// Client for communicating with the privileged helper via XPC.
/// This runs as the unprivileged user process and delegates privileged operations.
/// Uses a serial queue for `NSXPCConnection` state; XPC callbacks are not actor-isolated.
public final class PrivilegedHelperClient: @unchecked Sendable {
    public static let shared = PrivilegedHelperClient()

    private var connection: NSXPCConnection?
    private let connectionQueue = DispatchQueue(label: "com.sweepsrelief.PrivilegedHelperClient.connection")
    private let serviceName = "com.sweepsrelief.PrivilegedHelper"
    private let timeout: TimeInterval = 30.0

    private init() {}

    /// Check if the privileged helper is available and responsive.
    public func isHelperAvailable() async -> Bool {
        await withCheckedContinuation { continuation in
            let proxy = connectionQueue.sync { getProxyLocked() }
            guard let proxy = proxy else {
                continuation.resume(returning: false)
                return
            }
            proxy.ping { [weak self] responsive in
                if !responsive {
                    self?.connectionQueue.async {
                        self?.connection?.invalidate()
                        self?.connection = nil
                    }
                }
                continuation.resume(returning: responsive)
            }
        }
    }

    /// Apply verified hosts content via the privileged helper.
    /// - Parameters:
    ///   - hostsContent: The hosts content to write
    ///   - expectedDigest: SHA-256 hex digest that hostsContent must match
    /// - Returns: PrivilegedApplyResult with success status and details
    public func applyVerifiedHosts(_ hostsContent: String, expectedDigest: String) async -> PrivilegedApplyResult {
        // Verify digest locally before sending to helper (defense in depth)
        let actualDigest = Hashing.sha256Hex(Data(hostsContent.utf8))
        guard actualDigest == expectedDigest else {
            return PrivilegedApplyResult(
                success: false,
                message: "Digest mismatch: content does not match expected digest",
                error: .invalidDigest
            )
        }

        return await withCheckedContinuation { continuation in
            let proxy = connectionQueue.sync { getProxyLocked() }
            guard let proxy = proxy else {
                continuation.resume(returning: PrivilegedApplyResult(
                    success: false,
                    message: "Failed to connect to privileged helper",
                    error: .connectionFailed
                ))
                return
            }

            // Set up timeout
            let timeoutTask = Task {
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                continuation.resume(returning: PrivilegedApplyResult(
                    success: false,
                    message: "Privileged helper communication timed out",
                    error: .communicationTimeout
                ))
            }

            proxy.applyVerifiedHosts(hostsContent, expectedDigest: expectedDigest) { success, errorMessage, backupPath in
                timeoutTask.cancel()

                if success {
                    continuation.resume(returning: PrivilegedApplyResult(
                        success: true,
                        message: errorMessage ?? "Successfully applied to /etc/hosts",
                        backupPath: backupPath
                    ))
                } else {
                    let error: PrivilegedHelperError
                    if let msg = errorMessage {
                        if msg.contains("not authorized") {
                            error = .notAuthorized
                        } else if msg.contains("backup") {
                            error = .backupFailed(msg)
                        } else if msg.contains("digest") {
                            error = .invalidDigest
                        } else {
                            error = .writeFailed(msg)
                        }
                    } else {
                        error = .writeFailed("Unknown error")
                    }
                    continuation.resume(returning: PrivilegedApplyResult(
                        success: false,
                        message: errorMessage ?? "Unknown error",
                        error: error
                    ))
                }
            }
        }
    }

    /// Get the version of the privileged helper.
    public func getVersion() async -> String? {
        await withCheckedContinuation { continuation in
            let proxy = connectionQueue.sync { getProxyLocked() }
            guard let proxy = proxy else {
                continuation.resume(returning: nil)
                return
            }
            proxy.version { version in
                continuation.resume(returning: version)
            }
        }
    }

    /// Invalidate and clean up the connection.
    public func disconnect() {
        connectionQueue.sync {
            self.connection?.invalidate()
            self.connection = nil
        }
    }

    /// Call only on `connectionQueue`.
    private func getProxyLocked() -> PrivilegedHelperProtocol? {
        if connection == nil {
            let newConnection = NSXPCConnection(machServiceName: serviceName, options: [])
            newConnection.remoteObjectInterface = NSXPCInterface(with: PrivilegedHelperProtocol.self)
            newConnection.invalidationHandler = { [weak self] in
                self?.connectionQueue.async {
                    self?.connection = nil
                }
            }
            newConnection.interruptionHandler = { [weak self] in
                self?.connectionQueue.async {
                    self?.connection = nil
                }
            }
            newConnection.resume()
            connection = newConnection
        }
        return connection?.remoteObjectProxy as? PrivilegedHelperProtocol
    }
}

/// The privileged helper implementation (runs as root via launchd).
/// This class is instantiated by the privileged helper tool.
public final class PrivilegedHelper: NSObject, PrivilegedHelperProtocol, NSXPCListenerDelegate {
    public static let shared = PrivilegedHelper()
    public static let serviceName = "com.sweepsrelief.PrivilegedHelper"
    public static let etcHostsPath = "/etc/hosts"
    public static let backupDir = "/var/db/sweepsrelief/backups"

    private var listener: NSXPCListener?
    private let loggingQueue = DispatchQueue(label: "com.sweepsrelief.helper.logging")
    private let logPath = "/var/log/sweepsrelief-helper.log"

    private override init() {
        super.init()
    }

    /// Start listening for XPC connections.
    public func startListening() {
        listener = NSXPCListener(machServiceName: PrivilegedHelper.serviceName)
        listener?.delegate = self
        listener?.resume()
        log("Privileged helper started, listening for connections")
    }

    // MARK: - NSXPCListenerDelegate

    public func listener(_ listener: NSXPCListener, shouldAcceptNewConnection newConnection: NSXPCConnection) -> Bool {
        // Verify the connecting process has the right team identifier or is our known helper
        // In production, you'd use code signing verification here
        newConnection.remoteObjectInterface = NSXPCInterface(with: PrivilegedHelperProtocol.self)
        newConnection.exportedInterface = NSXPCInterface(with: PrivilegedHelperProtocol.self)
        newConnection.exportedObject = self
        newConnection.resume()
        log("Accepted new XPC connection")
        return true
    }

    // MARK: - PrivilegedHelperProtocol

    public func applyVerifiedHosts(_ hostsContent: String, expectedDigest: String, reply: @escaping (Bool, String?, String?) -> Void) {
        log("Received apply request with digest: \(expectedDigest.prefix(16))...")

        // Verify digest
        let actualDigest = Hashing.sha256Hex(Data(hostsContent.utf8))
        guard actualDigest == expectedDigest else {
            log("ERROR: Digest mismatch. Expected: \(expectedDigest), Got: \(actualDigest)")
            reply(false, "Digest mismatch: content verification failed", nil)
            return
        }

        // Create backup directory if needed
        let backupURL = URL(fileURLWithPath: PrivilegedHelper.backupDir)
        do {
            try FileManager.default.createDirectory(at: backupURL, withIntermediateDirectories: true, attributes: [
                .ownerAccountID: 0,
                .groupOwnerAccountID: 0,
                .posixPermissions: 0o755
            ])
        } catch {
            log("ERROR: Failed to create backup directory: \(error)")
            reply(false, "Failed to create backup directory: \(error.localizedDescription)", nil)
            return
        }

        // Create timestamped backup
        let timestamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let backupPath = "\(PrivilegedHelper.backupDir)/hosts.backup-\(timestamp)"

        // Backup current /etc/hosts if it exists
        if FileManager.default.fileExists(atPath: PrivilegedHelper.etcHostsPath) {
            do {
                try FileManager.default.copyItem(atPath: PrivilegedHelper.etcHostsPath, toPath: backupPath)
                log("Created backup at: \(backupPath)")
            } catch {
                log("ERROR: Failed to backup /etc/hosts: \(error)")
                reply(false, "Failed to backup /etc/hosts: \(error.localizedDescription)", nil)
                return
            }
        }

        // Validate hosts content format (basic safety checks)
        let validationResult = validateHostsContent(hostsContent)
        guard validationResult.isValid else {
            log("ERROR: Hosts content validation failed: \(validationResult.error ?? "unknown")")
            reply(false, "Hosts content validation failed: \(validationResult.error ?? "unknown")", nil)
            return
        }

        // Write to /etc/hosts atomically
        let tempPath = "\(PrivilegedHelper.etcHostsPath).tmp.\(ProcessInfo.processInfo.processIdentifier)"
        do {
            try hostsContent.write(toFile: tempPath, atomically: false, encoding: .utf8)

            // Set proper ownership (root:wheel) and permissions (644)
            try FileManager.default.setAttributes([
                .ownerAccountID: 0,
                .groupOwnerAccountID: 0,
                .posixPermissions: 0o644
            ], ofItemAtPath: tempPath)

            // Atomic rename
            try FileManager.default.moveItem(atPath: tempPath, toPath: PrivilegedHelper.etcHostsPath)

            log("Successfully applied hosts to \(PrivilegedHelper.etcHostsPath)")
            reply(true, "Successfully applied to /etc/hosts", backupPath)
        } catch {
            // Clean up temp file if it exists
            try? FileManager.default.removeItem(atPath: tempPath)

            // Attempt to restore from backup
            if FileManager.default.fileExists(atPath: backupPath) {
                do {
                    try FileManager.default.removeItem(atPath: PrivilegedHelper.etcHostsPath)
                    try FileManager.default.moveItem(atPath: backupPath, toPath: PrivilegedHelper.etcHostsPath)
                    log("Restored from backup after write failure")
                } catch {
                    log("CRITICAL: Failed to restore from backup: \(error)")
                }
            }

            log("ERROR: Failed to write /etc/hosts: \(error)")
            reply(false, "Failed to write /etc/hosts: \(error.localizedDescription)", nil)
        }
    }

    public func ping(_ reply: @escaping (Bool) -> Void) {
        log("Ping received, responding")
        reply(true)
    }

    public func version(_ reply: @escaping (String) -> Void) {
        reply("1.0.0")
    }

    // MARK: - Private

    private struct ValidationResult {
        let isValid: Bool
        let error: String?
    }

    private func validateHostsContent(_ content: String) -> ValidationResult {
        let lines = content.split(separator: "\n", omittingEmptySubsequences: false)

        for (index, line) in lines.enumerated() {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Skip empty lines and comments
            if trimmed.isEmpty || trimmed.hasPrefix("#") {
                continue
            }

            // Validate hosts file format: IP_address hostname [alias...]
            let components = trimmed.split(separator: " ", omittingEmptySubsequences: true)
            guard components.count >= 2 else {
                return ValidationResult(isValid: false, error: "Line \(index + 1) has invalid format: '\(trimmed)'")
            }

            // Validate IP address (basic check)
            let ip = String(components[0])
            guard isValidIP(ip) else {
                return ValidationResult(isValid: false, error: "Line \(index + 1) has invalid IP: '\(ip)'")
            }

            // Validate hostnames
            for i in 1..<components.count {
                let hostname = String(components[i])
                guard isValidHostname(hostname) else {
                    return ValidationResult(isValid: false, error: "Line \(index + 1) has invalid hostname: '\(hostname)'")
                }
            }
        }

        return ValidationResult(isValid: true, error: nil)
    }

    private func isValidIP(_ ip: String) -> Bool {
        // Accept 0.0.0.0, 127.0.0.1, ::1
        let validIPs = ["0.0.0.0", "127.0.0.1", "::1", "::ffff:127.0.0.1"]
        if validIPs.contains(ip) {
            return true
        }

        // Basic IPv4 validation
        let parts = ip.split(separator: ".")
        guard parts.count == 4 else { return false }
        for part in parts {
            guard let num = Int(part), num >= 0 && num <= 255 else { return false }
        }
        return true
    }

    private func isValidHostname(_ hostname: String) -> Bool {
        // Basic hostname validation
        // Must not be empty, must not contain spaces, must not start/end with dots
        guard !hostname.isEmpty else { return false }
        guard !hostname.contains(" ") else { return false }
        guard !hostname.hasPrefix(".") else { return false }
        guard !hostname.hasSuffix(".") else { return false }

        // Only allow alphanumeric, hyphens, and dots
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-."))
        return hostname.unicodeScalars.allSatisfy { allowed.contains($0) }
    }

    private func log(_ message: String) {
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let logLine = "[\(timestamp)] \(message)\n"
        loggingQueue.async {
            if let data = logLine.data(using: .utf8) {
                if FileManager.default.fileExists(atPath: self.logPath) {
                    if let handle = try? FileHandle(forWritingTo: URL(fileURLWithPath: self.logPath)) {
                        _ = try? handle.seekToEnd()
                        try? handle.write(contentsOf: data)
                        try? handle.close()
                    }
                } else {
                    try? data.write(to: URL(fileURLWithPath: self.logPath), options: .atomic)
                    // Set proper log permissions
                    try? FileManager.default.setAttributes([
                        .posixPermissions: 0o644
                    ], ofItemAtPath: self.logPath)
                }
            }
        }
    }
}

/// Installer for the privileged helper tool.
/// This is invoked by the main app to install the privileged helper in the system.
public enum PrivilegedHelperInstaller {
    public static let helperLabel = "com.sweepsrelief.PrivilegedHelper"
    public static let helperPath = "/Library/PrivilegedHelperTools/com.sweepsrelief.PrivilegedHelper"

    /// Check if the privileged helper is installed.
    public static func isInstalled() -> Bool {
        FileManager.default.fileExists(atPath: helperPath)
    }

    /// Install the privileged helper (requires user to authenticate via SMJobBless).
    /// Returns true if installation succeeded or was already installed.
    public static func install() throws -> Bool {
        // Note: Actual SMJobBless installation requires Security framework and
        // proper code signing. This is a placeholder that documents the requirements.
        //
        // In a full implementation, this would:
        // 1. Verify the helper binary is signed with the team's certificate
        // 2. Use SMJobBless to install the helper with user authorization
        // 3. Verify installation succeeded
        //
        // For now, this returns the current installation status.
        return isInstalled()
    }

    /// Uninstall the privileged helper.
    public static func uninstall() throws {
        // In a full implementation, this would:
        // 1. Stop the helper service
        // 2. Remove the helper binary
        // 3. Remove the launchd plist
        try? FileManager.default.removeItem(atPath: helperPath)
    }
}
