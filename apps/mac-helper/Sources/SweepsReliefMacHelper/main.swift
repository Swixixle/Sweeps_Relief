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
            RenderHosts.self,
            CheckTamper.self,
            PrintState.self,
        ]
    )
}

struct RunOnce: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "run-once")

    @Option(name: .long, help: "Path to config.json")
    var config: String

    func run() async throws {
        let cfg = try AppConfig.load(from: URL(fileURLWithPath: config))
        try await Runner.runOnce(config: cfg.resolved())
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
