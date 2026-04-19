import Foundation

/// Local helper configuration (JSON on disk).
public struct AppConfig: Codable, Sendable {
    public var policyURL: URL
    public var publicKeyPath: String
    public var stateDir: String
    public var hostsOutputPath: String
    public var appliedHashPath: String
    public var eventLogPath: String
    public var refreshIntervalSeconds: Int
    public var strictMode: Bool
    public var appliedVersionPath: String?
    public var policyCachePath: String?
    public var lastRunPath: String?
    public var deviceIdPath: String?

    enum CodingKeys: String, CodingKey {
        case policyURL = "policy_url"
        case publicKeyPath = "public_key_path"
        case stateDir = "state_dir"
        case hostsOutputPath = "hosts_output_path"
        case appliedHashPath = "applied_hash_path"
        case eventLogPath = "event_log_path"
        case refreshIntervalSeconds = "refresh_interval_seconds"
        case strictMode = "strict_mode"
        case appliedVersionPath = "applied_version_path"
        case policyCachePath = "policy_cache_path"
        case lastRunPath = "last_run_path"
        case deviceIdPath = "device_id_path"
    }

    public init(
        policyURL: URL,
        publicKeyPath: String,
        stateDir: String,
        hostsOutputPath: String,
        appliedHashPath: String,
        eventLogPath: String,
        refreshIntervalSeconds: Int = 900,
        strictMode: Bool = true,
        appliedVersionPath: String? = nil,
        policyCachePath: String? = nil,
        lastRunPath: String? = nil,
        deviceIdPath: String? = nil
    ) {
        self.policyURL = policyURL
        self.publicKeyPath = publicKeyPath
        self.stateDir = stateDir
        self.hostsOutputPath = hostsOutputPath
        self.appliedHashPath = appliedHashPath
        self.eventLogPath = eventLogPath
        self.refreshIntervalSeconds = refreshIntervalSeconds
        self.strictMode = strictMode
        self.appliedVersionPath = appliedVersionPath
        self.policyCachePath = policyCachePath
        self.lastRunPath = lastRunPath
        self.deviceIdPath = deviceIdPath
    }

    public static func load(from url: URL) throws -> AppConfig {
        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        return try decoder.decode(AppConfig.self, from: data)
    }

    /// Resolve default companion paths relative to `stateDir` when optional paths are nil.
    public func resolved() -> ResolvedAppConfig {
        let state = URL(fileURLWithPath: stateDir, isDirectory: true)
        let appliedVersion = appliedVersionPath.map { URL(fileURLWithPath: $0) }
            ?? state.appendingPathComponent("applied_policy_version.txt")
        let policyCache = policyCachePath.map { URL(fileURLWithPath: $0) }
            ?? state.appendingPathComponent("policy_cache.json")
        let lastRun = lastRunPath.map { URL(fileURLWithPath: $0) }
            ?? state.appendingPathComponent("last_run.json")
        let deviceId = deviceIdPath.map { URL(fileURLWithPath: $0) }
            ?? state.appendingPathComponent("device_id.txt")
        return ResolvedAppConfig(
            raw: self,
            stateDirectory: state,
            publicKeyURL: URL(fileURLWithPath: publicKeyPath),
            hostsOutputURL: URL(fileURLWithPath: hostsOutputPath),
            appliedHashURL: URL(fileURLWithPath: appliedHashPath),
            eventLogURL: URL(fileURLWithPath: eventLogPath),
            appliedVersionURL: appliedVersion,
            policyCacheURL: policyCache,
            lastRunURL: lastRun,
            deviceIdURL: deviceId
        )
    }
}

public struct ResolvedAppConfig: Sendable {
    public let raw: AppConfig
    public let stateDirectory: URL
    public let publicKeyURL: URL
    public let hostsOutputURL: URL
    public let appliedHashURL: URL
    public let eventLogURL: URL
    public let appliedVersionURL: URL
    public let policyCacheURL: URL
    public let lastRunURL: URL
    public let deviceIdURL: URL
}
