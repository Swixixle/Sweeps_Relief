import Foundation

/// Deterministic hosts-style blocklist from policy domains + funnel domains.
public enum HostsRenderer {
    public static func render(policyJSONData: Data) throws -> String {
        let obj = try JSONSerialization.jsonObject(with: policyJSONData, options: [])
        guard let root = obj as? [String: Any],
              let policy = root["policy"] as? [String: Any]
        else {
            throw HostsRendererError.missingPolicy
        }
        let domains = (policy["domains"] as? [String]) ?? []
        let funnel = (policy["funnel_domains"] as? [String]) ?? []
        let affiliate = (policy["affiliate_domains"] as? [String]) ?? []
        let all = Set(domains + funnel + affiliate)
        var lines: [String] = [
            "# SweepsRelief generated hosts",
            "# Deterministic block list — do not edit by hand",
            "",
            "127.0.0.1\tlocalhost",
            "::1\tlocalhost",
            "",
        ]
        for d in all.sorted() {
            let host = d.lowercased()
            lines.append("0.0.0.0\t\(host)")
            if !host.hasPrefix("www.") {
                lines.append("0.0.0.0\twww.\(host)")
            }
        }
        lines.append("")
        return lines.joined(separator: "\n")
    }
}

public enum HostsRendererError: Error {
    case missingPolicy
}
