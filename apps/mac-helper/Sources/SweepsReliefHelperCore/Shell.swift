import Foundation

public enum Shell {
    /// Run a subprocess; use sparingly for future privileged helper hooks.
    public static func run(_ launchPath: String, arguments: [String]) throws -> Int32 {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: launchPath)
        p.arguments = arguments
        try p.run()
        p.waitUntilExit()
        return p.terminationStatus
    }

    public static func runAndThrow(_ launchPath: String, arguments: [String]) throws {
        let code = try run(launchPath, arguments: arguments)
        if code != 0 {
            throw NSError(domain: "Shell", code: Int(code), userInfo: [NSLocalizedDescriptionKey: "exit \(code)"])
        }
    }
}
