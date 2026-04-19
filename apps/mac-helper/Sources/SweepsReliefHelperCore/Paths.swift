import Foundation

public enum Paths {
    /// Default user Application Support directory for SweepsRelief state.
    public static var defaultStateDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return base.appendingPathComponent("SweepsRelief", isDirectory: true)
    }
}
