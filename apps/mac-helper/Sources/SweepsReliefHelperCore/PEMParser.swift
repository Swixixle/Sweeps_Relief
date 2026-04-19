import Foundation

public enum PEMParserError: Error {
    case invalidPEM
    case unsupportedKeyFormat
}

/// Extract raw 32-byte Ed25519 public key from PEM (SubjectPublicKeyInfo) or accept raw base64 of 32 bytes.
public enum PEMParser {
    public static func ed25519PublicKeyRaw(fromPEM pem: String) throws -> Data {
        let trimmed = pem
            .split(separator: "\n")
            .filter { !$0.hasPrefix("-----") }
            .joined()
        guard let der = Data(base64Encoded: trimmed, options: [.ignoreUnknownCharacters]) else {
            throw PEMParserError.invalidPEM
        }
        if der.count == 32 {
            return der
        }
        // SPKI Ed25519: BIT STRING tag 0x03, length 0x21, 0x00 unused bits, then 32-byte raw public key.
        // cryptography/OpenSSL may omit the optional NULL (0x05 0x00) after the OID, so avoid fixed offsets.
        let marker = Data([0x03, 0x21, 0x00])
        guard let r = der.range(of: marker) else {
            throw PEMParserError.unsupportedKeyFormat
        }
        let keyStart = r.upperBound
        guard keyStart + 32 <= der.count else {
            throw PEMParserError.unsupportedKeyFormat
        }
        return der.subdata(in: keyStart ..< keyStart + 32)
    }
}
