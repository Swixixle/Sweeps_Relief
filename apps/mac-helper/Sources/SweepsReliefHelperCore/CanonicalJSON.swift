import Foundation

/// Matches Python `json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")`.
public enum CanonicalJSONError: Error {
    case unsupportedType(String)
}

public enum CanonicalJSON {
    /// Produce canonical UTF-8 bytes for JSON-compatible values (NSDictionary, NSArray, NSString, NSNumber, NSNull).
    public static func data(from object: Any) throws -> Data {
        let str = try string(from: object)
        return Data(str.utf8)
    }

    public static func string(from object: Any) throws -> String {
        try serialize(object)
    }

    private static func serialize(_ object: Any) throws -> String {
        switch object {
        case is NSNull:
            return "null"
        case let b as Bool:
            return b ? "true" : "false"
        case let n as NSNumber:
            return try serializeNumber(n)
        case let s as String:
            return try escapeString(s)
        case let arr as [Any]:
            let parts = try arr.map { try serialize($0) }
            return "[\(parts.joined(separator: ","))]"
        case let dict as [String: Any]:
            let keys = dict.keys.sorted()
            var parts: [String] = []
            for k in keys {
                guard let v = dict[k] else { continue }
                let keyJson = try escapeString(k)
                let valJson = try serialize(v)
                parts.append("\(keyJson):\(valJson)")
            }
            return "{\(parts.joined(separator: ","))}"
        case let dict as NSDictionary:
            var swift: [String: Any] = [:]
            for (k, v) in dict {
                guard let ks = k as? String else {
                    throw CanonicalJSONError.unsupportedType("non-string dict key")
                }
                swift[ks] = v
            }
            return try serialize(swift)
        case let arr as NSArray:
            return try serialize(arr as! [Any])
        default:
            throw CanonicalJSONError.unsupportedType(String(describing: type(of: object)))
        }
    }

    private static func serializeNumber(_ n: NSNumber) throws -> String {
        if CFGetTypeID(n) == CFBooleanGetTypeID() {
            return n.boolValue ? "true" : "false"
        }
        // Prefer integer formatting when exact (matches Python int JSON).
        let d = n.doubleValue
        if d.isFinite, d == d.rounded(), abs(d) <= Double(Int64.max), abs(d) >= Double(Int64.min) {
            if let i = Int64(exactly: d) {
                return "\(i)"
            }
        }
        // Float: Python json uses shortest representation; %g is close for policy floats.
        if d.isFinite, !d.isNaN {
            let s = String(format: "%.17g", d)
            return s
        }
        throw CanonicalJSONError.unsupportedType("number")
    }

    private static func escapeString(_ s: String) throws -> String {
        var out = "\""
        for u in s.unicodeScalars {
            switch u.value {
            case 0x22: out += "\\\""
            case 0x5C: out += "\\\\"
            case 0x08: out += "\\b"
            case 0x0C: out += "\\f"
            case 0x0A: out += "\\n"
            case 0x0D: out += "\\r"
            case 0x09: out += "\\t"
            default:
                if u.value < 0x20 {
                    out += String(format: "\\u%04x", u.value)
                } else {
                    out.append(String(u))
                }
            }
        }
        out += "\""
        return out
    }
}
