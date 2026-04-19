import Foundation

/// Delimiters for the only `/etc/hosts` region the privileged helper may replace.
public enum PrivilegedEtcHostsMerge {
    public static let beginMarker = "# BEGIN SWEEPS_RELIEF_MANAGED"
    public static let endMarker = "# END SWEEPS_RELIEF_MANAGED"

    public enum MergeError: Error, Equatable {
        /// `# BEGIN` without a matching `# END` after it.
        case orphanBeginMarker
        /// `# END` appears in the file without a `# BEGIN` section above it.
        case orphanEndMarker
    }

    /// Builds the managed block: begin marker, verbatim inner content (from `HostsRenderer`), end marker.
    public static func wrappedManagedBlock(innerContent: String) -> String {
        let inner = innerContent.hasSuffix("\n") ? innerContent : innerContent + "\n"
        return "\(beginMarker)\n\(inner)\(endMarker)\n"
    }

    /// Merges verified renderer output into existing hosts text: replaces a prior SweepsRelief block, or appends one.
    public static func mergeManagedSection(intoExisting existingRaw: String, managedInnerContent: String) -> Result<String, MergeError> {
        let existing = normalizeNewlines(existingRaw)

        if existing.isEmpty {
            return .success(wrappedManagedBlock(innerContent: managedInnerContent))
        }

        let lines = existing.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let trimmed = lines.map { $0.trimmingCharacters(in: .whitespaces) }

        if let beginIdx = trimmed.firstIndex(of: beginMarker) {
            var endIdx: Int?
            for k in (beginIdx + 1) ..< trimmed.count {
                if trimmed[k] == endMarker {
                    endIdx = k
                    break
                }
            }
            guard let e = endIdx else {
                return .failure(.orphanBeginMarker)
            }
            return .success(spliced(lines: lines, beginIdx: beginIdx, endIdx: e, managedInnerContent: managedInnerContent))
        }

        if trimmed.contains(endMarker) {
            return .failure(.orphanEndMarker)
        }

        return .success(appendBlock(to: existing, managedInnerContent: managedInnerContent))
    }

    private static func normalizeNewlines(_ s: String) -> String {
        s.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n")
    }

    private static func appendBlock(to existing: String, managedInnerContent: String) -> String {
        let block = wrappedManagedBlock(innerContent: managedInnerContent)
        if existing.hasSuffix("\n") {
            return existing + "\n" + block
        }
        return existing + "\n\n" + block
    }

    private static func spliced(lines: [String], beginIdx: Int, endIdx: Int, managedInnerContent: String) -> String {
        let block = wrappedManagedBlock(innerContent: managedInnerContent)
        var out = ""
        if beginIdx > 0 {
            out = lines[0 ..< beginIdx].joined(separator: "\n")
            out += "\n"
        }
        out += block
        let tailStart = endIdx + 1
        if tailStart < lines.count {
            out += lines[tailStart..<lines.count].joined(separator: "\n")
        }
        return out
    }
}
