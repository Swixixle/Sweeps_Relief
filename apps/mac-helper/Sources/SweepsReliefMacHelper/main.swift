import ArgumentParser
import Foundation
import SweepsReliefHelperCore

@main
struct SweepsReliefCLI: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "SweepsReliefMacHelper",
        subcommands: [
            RunOnce.self,
            InstallLaunchAgent.self,
            UninstallLaunchAgent.self,
            InstallPrivilegedHelper.self,
            PrivilegedHelperStatus.self,
            RenderHosts.self,
            CheckTamper.self,
            PrintState.self,
            ArchiveEventLog.self,
        ]
    )
}

struct RunOnce: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "run-once")

    @Option(name: .long, help: "Path to config.json")
    var config: String

    @Option(name: .long, help: "Apply mode: dry_run, privileged, privileged_required")
    var applyMode: String?

    func run() async throws {
        let cfg = try AppConfig.load(from: URL(fileURLWithPath: config))
        let resolved = cfg.resolved()

        // Determine apply mode: CLI flag > config > default
        let mode: ApplyMode
        if let modeStr = applyMode?.lowercased() ?? cfg.applyMode?.lowercased() {
            switch modeStr {
            case "privileged_required":
                mode = .privilegedRequired
            case "privileged", "privileged_with_fallback":
                mode = .privilegedWithFallback
            default:
                mode = .dryRun
            }
        } else {
            mode = .dryRun
        }

        try await Runner.runOnce(config: resolved, applyMode: mode)
    }
}

struct InstallLaunchAgent: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "install-launchagent")

    @Option(name: .long, help: "Path to config.json")
    var config: String

    @Option(name: .long, help: "Path to this helper binary (use `which SweepsReliefMacHelper` after install)")
    var helperPath: String

    func run() throws {
        let cfg = try AppConfig.load(from: URL(fileURLWithPath: config)).resolved()
        try EventLogger.appendLine(
            logURL: cfg.eventLogURL,
            deviceId: try DeviceIdentity.deviceId(file: cfg.deviceIdURL),
            type: "launchagent_installed",
            context: ["plist": LaunchAgentInstaller.plistName]
        )
        try LaunchAgentInstaller.install(
            helperBinaryPath: helperPath,
            configPath: config,
            intervalSeconds: cfg.raw.refreshIntervalSeconds
        )
    }
}

struct UninstallLaunchAgent: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "uninstall-launchagent")

    func run() throws {
        try LaunchAgentInstaller.uninstall()
    }
}

struct InstallPrivilegedHelper: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "install-privileged-helper")

    func run() throws {
        if PrivilegedHelperInstaller.isInstalled() {
            print("Privileged helper is already installed at \(PrivilegedHelperInstaller.helperPath)")
            return
        }

        print("Privileged helper installation requires user authentication.")
        print("NOTE: This is a placeholder. Full SMJobBless implementation requires:")
        print("  1. Signed helper binary with Team ID")
        print("  2. LaunchServices plist in /Library/LaunchDaemons")
        print("  3. Proper entitlements and Info.plist")
        print("")
        print("For testing, manually install the helper:")
        print("  sudo cp .build/release/SweepsReliefPrivilegedHelper \(PrivilegedHelperInstaller.helperPath)")
        print("  sudo chmod 4755 \(PrivilegedHelperInstaller.helperPath)")

        let installed = try PrivilegedHelperInstaller.install()
        if installed {
            print("Privileged helper is installed.")
        } else {
            print("Privileged helper installation requires additional setup (see above).")
        }
    }
}

struct PrivilegedHelperStatus: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "privileged-helper-status")

    func run() async throws {
        let installed = PrivilegedHelperInstaller.isInstalled()
        print("Installed: \(installed)")
        if installed {
            print("Path: \(PrivilegedHelperInstaller.helperPath)")

            let client = PrivilegedHelperClient.shared
            let available = await client.isHelperAvailable()
            print("Responsive: \(available)")

            if available {
                if let version = await client.getVersion() {
                    print("Version: \(version)")
                }
            }
        }
    }
}

struct RenderHosts: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "render-hosts")

    @Option(name: .long, help: "Path to config.json (uses policy_cache.json if present, else fetches)")
    var config: String

    func run() async throws {
        let cfg = try AppConfig.load(from: URL(fileURLWithPath: config)).resolved()
        let data: Data
        if FileManager.default.fileExists(atPath: cfg.policyCacheURL.path) {
            data = try Data(contentsOf: cfg.policyCacheURL)
        } else {
            data = try await PolicyFetcher.fetch(url: cfg.raw.policyURL)
        }
        let pem = try String(contentsOf: cfg.publicKeyURL, encoding: .utf8)
        try PolicyVerifier.verifyArtifact(policyJSONData: data, publicKeyPEM: pem)
        let hosts = try HostsRenderer.render(policyJSONData: data)
        FileHandle.standardOutput.write(Data(hosts.utf8))
    }
}

struct CheckTamper: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "check-tamper")

    @Option(name: .long, help: "Path to config.json")
    var config: String

    func run() throws {
        let cfg = try AppConfig.load(from: URL(fileURLWithPath: config)).resolved()
        guard FileManager.default.fileExists(atPath: cfg.policyCacheURL.path) else {
            fputs("No policy cache at \(cfg.policyCacheURL.path)\n", stderr)
            throw ExitCode(1)
        }
        let data = try Data(contentsOf: cfg.policyCacheURL)
        let hash = try PolicyVerifier.policyContentHash(policyJSONData: data)
        let applied = PolicyStateStore.readAppliedHash(at: cfg.appliedHashURL)
        let hostsText = try? String(contentsOf: cfg.hostsOutputURL, encoding: .utf8)
        let report = TamperChecker.check(
            expectedPolicyData: data,
            hostsContent: hostsText,
            appliedHashFromDisk: applied,
            expectedContentHash: hash
        )
        print("issues: \(report.issues)")
        if !report.isClean {
            throw ExitCode(2)
        }
    }
}

struct PrintState: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "print-state")

    @Option(name: .long, help: "Path to config.json")
    var config: String

    func run() throws {
        let cfg = try AppConfig.load(from: URL(fileURLWithPath: config)).resolved()
        print("state_dir: \(cfg.stateDirectory.path)")
        print("applied_hash: \(PolicyStateStore.readAppliedHash(at: cfg.appliedHashURL) ?? "(none)")")
        print("applied_version: \(PolicyStateStore.readAppliedVersion(at: cfg.appliedVersionURL) ?? "(none)")")
        print("device_id: \(try DeviceIdentity.deviceId(file: cfg.deviceIdURL))")
        if let lr = try? Data(contentsOf: cfg.lastRunURL),
           let s = String(data: lr, encoding: .utf8)
        {
            print("last_run: \(s)")
        }
    }
}

struct ArchiveEventLog: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "archive-event-log")

    @Option(name: .long, help: "Path to config.json")
    var config: String

    func run() throws {
        let cfg = try AppConfig.load(from: URL(fileURLWithPath: config)).resolved()
        if let dest = try EventLogger.archiveEventLogIfPresent(at: cfg.eventLogURL) {
            print("Archived event log to: \(dest.path)")
        } else {
            print("No event log at \(cfg.eventLogURL.path); nothing to archive.")
        }
    }
}
