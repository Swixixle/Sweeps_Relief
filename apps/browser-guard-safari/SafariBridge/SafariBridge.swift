import Foundation

/// Stub for the native Safari shell. Replace with `SFSafariApplication` / extension lifecycle in Xcode.
public enum SafariBridge {
  public static let placeholderVersion = "0.1.0"

  public static func noteExtensionLoaded() {
    // Hook: log load, surface debug UI, or coordinate with mac-helper over XPC later.
  }
}
