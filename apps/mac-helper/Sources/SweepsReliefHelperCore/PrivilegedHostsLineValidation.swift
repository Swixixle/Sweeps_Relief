import Foundation

/// Line/format checks for hosts content before privileged apply (same rules as `PrivilegedHelper`).
public enum PrivilegedHostsLineValidation {
    /// Returns `nil` if every non-empty, non-comment line is a plausible hosts row; otherwise a human-readable reason.
    public static func validationReason(for content: String) -> String? {
        let lines = content.split(separator: "\n", omittingEmptySubsequences: false)

        for (index, line) in lines.enumerated() {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if trimmed.isEmpty || trimmed.hasPrefix("#") {
                continue
            }

            let components = trimmed.split(whereSeparator: \.isWhitespace)
            guard components.count >= 2 else {
                return "Line \(index + 1) has invalid format: '\(trimmed)'"
            }

            let ip = String(components[0])
            guard isValidIP(ip) else {
                return "Line \(index + 1) has invalid IP: '\(ip)'"
            }

            for i in 1..<components.count {
                let hostname = String(components[i])
                guard isValidHostname(hostname) else {
                    return "Line \(index + 1) has invalid hostname: '\(hostname)'"
                }
            }
        }

        return nil
    }

    private static func isValidIP(_ ip: String) -> Bool {
        let validIPs = ["0.0.0.0", "127.0.0.1", "::1", "::ffff:127.0.0.1"]
        if validIPs.contains(ip) {
            return true
        }

        let parts = ip.split(separator: ".")
        guard parts.count == 4 else { return false }
        for part in parts {
            guard let num = Int(part), num >= 0 && num <= 255 else { return false }
        }
        return true
    }

    private static func isValidHostname(_ hostname: String) -> Bool {
        guard !hostname.isEmpty else { return false }
        guard !hostname.contains(" ") else { return false }
        guard !hostname.hasPrefix(".") else { return false }
        guard !hostname.hasSuffix(".") else { return false }

        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-."))
        return hostname.unicodeScalars.allSatisfy { allowed.contains($0) }
    }
}
