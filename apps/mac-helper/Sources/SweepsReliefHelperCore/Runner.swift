import Foundation

/// End-to-end `run-once` control flow.
public enum Runner {
    public enum Outcome: String {
        case policyFetchStarted
        case policyFetchFailed
        case policyVerificationFailed
        case policyUnchanged
        case policyUpdateApplied
        case applyFailed
        case tamperDetected
        case driftDetected
    }

    public static func runOnce(config: ResolvedAppConfig, applyMode: ApplyMode = .dryRun) async throws {
        let deviceId = try DeviceIdentity.deviceId(file: config.deviceIdURL)
        let pem = try String(contentsOf: config.publicKeyURL, encoding: .utf8)

        try EventLogger.appendLine(
            logURL: config.eventLogURL,
            deviceId: deviceId,
            type: "policy_fetch_started",
            target: config.raw.policyURL.absoluteString
        )

        let data: Data
        do {
            data = try await PolicyFetcher.fetch(url: config.raw.policyURL)
        } catch {
            try EventLogger.appendLine(
                logURL: config.eventLogURL,
                deviceId: deviceId,
                type: "policy_fetch_failed",
                target: config.raw.policyURL.absoluteString,
                context: ["error": String(describing: error)]
            )
            try PolicyStateStore.writeLastRun(
                PolicyStateStore.LastRun(ts: isoNow(), outcome: Outcome.policyFetchFailed.rawValue),
                to: config.lastRunURL
            )
            throw error
        }

        do {
            try PolicyVerifier.verifyArtifact(policyJSONData: data, publicKeyPEM: pem)
        } catch {
            try EventLogger.appendLine(
                logURL: config.eventLogURL,
                deviceId: deviceId,
                type: "policy_verification_failed",
                context: ["error": String(describing: error)]
            )
            try PolicyStateStore.writeLastRun(
                PolicyStateStore.LastRun(ts: isoNow(), outcome: Outcome.policyVerificationFailed.rawValue),
                to: config.lastRunURL
            )
            throw error
        }

        let contentHash = try PolicyVerifier.policyContentHash(policyJSONData: data)
        let version = try PolicyVerifier.policyVersion(policyJSONData: data)
        let lastApplied = PolicyStateStore.readAppliedHash(at: config.appliedHashURL)

        try PolicyStateStore.writePolicyCache(data, to: config.policyCacheURL)

        if lastApplied == contentHash {
            try EventLogger.appendLine(logURL: config.eventLogURL, deviceId: deviceId, type: "policy_unchanged")
            try runTamperCheck(config: config, policyData: data, deviceId: deviceId, contentHash: contentHash)
            try PolicyStateStore.writeLastRun(
                PolicyStateStore.LastRun(ts: isoNow(), outcome: Outcome.policyUnchanged.rawValue),
                to: config.lastRunURL
            )
            return
        }

        let hosts: String
        do {
            hosts = try HostsRenderer.render(policyJSONData: data)
        } catch {
            try EventLogger.appendLine(
                logURL: config.eventLogURL,
                deviceId: deviceId,
                type: "apply_failed",
                context: ["phase": "render", "error": String(describing: error)]
            )
            throw error
        }

        let applyResult: ApplyResult
        do {
            applyResult = try await PolicyApplier.apply(
                hosts: hosts,
                mode: applyMode,
                to: config.hostsOutputURL,
                expectedDigest: Hashing.sha256Hex(Data(hosts.utf8))
            )
        } catch {
            try EventLogger.appendLine(
                logURL: config.eventLogURL,
                deviceId: deviceId,
                type: "apply_failed",
                context: ["phase": "write_hosts", "mode": applyModeLabel(applyMode), "error": String(describing: error)]
            )
            try PolicyStateStore.writeLastRun(
                PolicyStateStore.LastRun(ts: isoNow(), outcome: Outcome.applyFailed.rawValue),
                to: config.lastRunURL
            )
            throw error
        }

        // Log privileged apply details if used
        if applyResult.usedPrivilegedPath {
            var context: [String: Any] = ["mode": "privileged"]
            if let backupPath = applyResult.backupPath {
                context["backup_path"] = backupPath
            }
            try EventLogger.appendLine(
                logURL: config.eventLogURL,
                deviceId: deviceId,
                type: "privileged_apply_succeeded",
                context: context
            )
        }

        try PolicyStateStore.writeAppliedHash(contentHash, to: config.appliedHashURL)
        try PolicyStateStore.writeAppliedVersion(version, to: config.appliedVersionURL)

        try EventLogger.appendLine(
            logURL: config.eventLogURL,
            deviceId: deviceId,
            type: "policy_update_applied",
            context: ["version": version, "hash": contentHash]
        )
        try runTamperCheck(config: config, policyData: data, deviceId: deviceId, contentHash: contentHash)
        try PolicyStateStore.writeLastRun(
            PolicyStateStore.LastRun(ts: isoNow(), outcome: Outcome.policyUpdateApplied.rawValue),
            to: config.lastRunURL
        )
    }

    private static func runTamperCheck(
        config: ResolvedAppConfig,
        policyData: Data,
        deviceId: String,
        contentHash: String
    ) throws {
        let applied = PolicyStateStore.readAppliedHash(at: config.appliedHashURL)
        let hostsText = try? String(contentsOf: config.hostsOutputURL, encoding: .utf8)
        let report = TamperChecker.check(
            expectedPolicyData: policyData,
            hostsContent: hostsText,
            appliedHashFromDisk: applied,
            expectedContentHash: contentHash
        )
        if !report.isClean {
            try EventLogger.appendLine(
                logURL: config.eventLogURL,
                deviceId: deviceId,
                type: report.issues.contains("hosts_content_drift") ? "drift_detected" : "tamper_detected",
                context: ["issues": report.issues]
            )
        }
    }

    private static func isoNow() -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.string(from: Date())
    }

    private static func applyModeLabel(_ mode: ApplyMode) -> String {
        switch mode {
        case .dryRun: return "dry_run"
        case .privilegedWithFallback: return "privileged_with_fallback"
        case .privilegedRequired: return "privileged_required"
        }
    }
}
