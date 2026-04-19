import Foundation

/// Policy fetch must not use shared URLSession disk/memory caches: a mutable `policy.json` at the same URL must always re-fetch.
/// Stale cache bytes caused false hash mismatches vs on-disk/Python-verified policy after local file restore (strict validation 2026-04).
public enum PolicyFetcherError: Error {
    case httpStatus(Int)
    case emptyBody
}

public enum PolicyFetcher {
    /// Fetches policy bytes without using the shared URL cache (avoids stale policy after server-side updates).
    public static func fetch(url: URL) async throws -> Data {
        let config = URLSessionConfiguration.ephemeral
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.urlCache = nil
        let session = URLSession(configuration: config)
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw PolicyFetcherError.emptyBody
        }
        guard (200 ... 299).contains(http.statusCode) else {
            throw PolicyFetcherError.httpStatus(http.statusCode)
        }
        guard !data.isEmpty else {
            throw PolicyFetcherError.emptyBody
        }
        return data
    }
}
