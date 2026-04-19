import Foundation

public enum LaunchAgentError: Error {
    case templateMissing
    case invalidHelperPath
}

public enum LaunchAgentInstaller {
    public static let plistName = "com.sweepsrelief.helper.plist"
    public static let launchAgentsDir = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/LaunchAgents", isDirectory: true)

    public static func install(
        helperBinaryPath: String,
        configPath: String,
        intervalSeconds: Int,
        templateURL: URL? = nil
    ) throws {
        let dest = launchAgentsDir.appendingPathComponent(plistName)
        try FileManager.default.createDirectory(at: launchAgentsDir, withIntermediateDirectories: true)
        let tpl: String
        if let templateURL {
            tpl = try String(contentsOf: templateURL, encoding: .utf8)
        } else {
            tpl = embeddedTemplate
        }
        let filled = tpl
            .replacingOccurrences(of: "{{HELPER_PATH}}", with: helperBinaryPath)
            .replacingOccurrences(of: "{{CONFIG_PATH}}", with: configPath)
            .replacingOccurrences(of: "{{INTERVAL}}", with: "\(intervalSeconds)")
        try filled.write(to: dest, atomically: true, encoding: .utf8)
        _ = try? Shell.run("/bin/launchctl", arguments: ["unload", dest.path])
        try Shell.runAndThrow("/bin/launchctl", arguments: ["load", "-w", dest.path])
    }

    public static func uninstall() throws {
        let dest = launchAgentsDir.appendingPathComponent(plistName)
        if FileManager.default.fileExists(atPath: dest.path) {
            _ = try? Shell.run("/bin/launchctl", arguments: ["unload", dest.path])
            try FileManager.default.removeItem(at: dest)
        }
    }

    private static let embeddedTemplate = """
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
    <dict>
      <key>Label</key>
      <string>com.sweepsrelief.helper</string>
      <key>ProgramArguments</key>
      <array>
        <string>{{HELPER_PATH}}</string>
        <string>run-once</string>
        <string>--config</string>
        <string>{{CONFIG_PATH}}</string>
      </array>
      <key>RunAtLoad</key>
      <true/>
      <key>StartInterval</key>
      <integer>{{INTERVAL}}</integer>
      <key>StandardOutPath</key>
      <string>/tmp/sweepsrelief-helper.log</string>
      <key>StandardErrorPath</key>
      <string>/tmp/sweepsrelief-helper.err</string>
    </dict>
    </plist>
    """
}
