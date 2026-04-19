import Crypto
import Foundation

public enum PolicyVerifierError: Error {
    case invalidJSON
    case missingPolicyField
    case hashMismatch
    case invalidSignature
    case invalidBase64Signature
}

/// Verifies signed policy artifacts compatible with the Python control plane.
public enum PolicyVerifier {
    /// Parse policy.json, verify SHA-256 of canonical policy body and Ed25519 signature.
    public static func verifyArtifact(policyJSONData: Data, publicKeyPEM: String) throws {
        let obj = try JSONSerialization.jsonObject(with: policyJSONData, options: [])
        guard let root = obj as? [String: Any],
              let policyObj = root["policy"]
        else {
            throw PolicyVerifierError.missingPolicyField
        }
        let stripped = stripNulls(policyObj)
        let canonical = try CanonicalJSON.data(from: stripped)
        let expectedHash = Hashing.sha256Hex(canonical)
        guard let artifactHash = root["hash"] as? String, artifactHash == expectedHash else {
            throw PolicyVerifierError.hashMismatch
        }
        guard let sigB64 = root["signature_b64"] as? String,
              let signature = Data(base64Encoded: sigB64, options: [.ignoreUnknownCharacters])
        else {
            throw PolicyVerifierError.invalidBase64Signature
        }
        let rawKey = try PEMParser.ed25519PublicKeyRaw(fromPEM: publicKeyPEM)
        let publicKey = try Curve25519.Signing.PublicKey(rawRepresentation: rawKey)
        guard publicKey.isValidSignature(signature, for: canonical) else {
            throw PolicyVerifierError.invalidSignature
        }
    }

    /// Returns semantic version string from verified policy (for monotonicity checks by caller).
    public static func policyVersion(policyJSONData: Data) throws -> String {
        let obj = try JSONSerialization.jsonObject(with: policyJSONData, options: [])
        guard let root = obj as? [String: Any],
              let policy = root["policy"] as? [String: Any],
              let v = policy["version"] as? String
        else {
            throw PolicyVerifierError.invalidJSON
        }
        return v
    }

    /// Policy body canonical hex digest (must match `hash` field when verification passes).
    public static func policyContentHash(policyJSONData: Data) throws -> String {
        let obj = try JSONSerialization.jsonObject(with: policyJSONData, options: [])
        guard let root = obj as? [String: Any], let policyObj = root["policy"] else {
            throw PolicyVerifierError.missingPolicyField
        }
        let stripped = stripNulls(policyObj)
        let canonical = try CanonicalJSON.data(from: stripped)
        return Hashing.sha256Hex(canonical)
    }

    private static func stripNulls(_ any: Any) -> Any {
        switch any {
        case is NSNull:
            return NSNull()
        case let d as [String: Any]:
            var out: [String: Any] = [:]
            for (k, v) in d {
                if v is NSNull { continue }
                out[k] = stripNulls(v)
            }
            return out
        case let a as [Any]:
            return a.map { stripNulls($0) }
        case let a as NSArray:
            return (a as! [Any]).map { stripNulls($0) }
        default:
            return any
        }
    }
}
