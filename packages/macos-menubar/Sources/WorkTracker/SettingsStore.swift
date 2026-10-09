import Foundation
import WorkTrackerCore

/// Persistent settings — the macOS equivalent of the GNOME extension's GSettings schema.
/// Everything lives in UserDefaults except the API token, which is kept in the Keychain.
final class SettingsStore {
    private let defaults: UserDefaults

    private enum Key {
        static let serverURL = "serverURL"
        static let slotSlugs = "slotSlugs"
        static let slotLabels = "slotLabels"
        static let activeSlot = "activeSlot"
        static let autoStopOnLock = "autoStopOnLock"
        static let apiToken = "apiToken" // Keychain account
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        defaults.register(defaults: [Key.autoStopOnLock: true, Key.activeSlot: -1])
    }

    var serverURL: String {
        get { defaults.string(forKey: Key.serverURL) ?? "" }
        set { defaults.set(newValue, forKey: Key.serverURL) }
    }

    /// Cached after the first read: every Keychain read can trigger an access
    /// prompt for ad-hoc signed builds.
    private var cachedToken: String?

    var apiToken: String {
        get {
            if let cachedToken { return cachedToken }
            let token = Keychain.get(Key.apiToken) ?? ""
            cachedToken = token
            return token
        }
        set {
            cachedToken = newValue
            Keychain.set(newValue, for: Key.apiToken)
        }
    }

    var autoStopOnLock: Bool {
        get { defaults.bool(forKey: Key.autoStopOnLock) }
        set { defaults.set(newValue, forKey: Key.autoStopOnLock) }
    }

    /// Active slot index (0-based), -1 when nothing is tracked.
    var activeSlot: Int {
        get { defaults.integer(forKey: Key.activeSlot) }
        set { defaults.set(newValue, forKey: Key.activeSlot) }
    }

    /// Cached project buttons so the bar renders immediately on launch, even offline.
    var slots: [Slot] {
        get {
            let slugs = defaults.stringArray(forKey: Key.slotSlugs) ?? []
            let labels = defaults.stringArray(forKey: Key.slotLabels) ?? []
            return zip(slugs, labels).enumerated().compactMap { index, pair in
                pair.0.isEmpty ? nil : Slot(index: index, slug: pair.0, label: pair.1)
            }
        }
        set {
            var slugs = Array(repeating: "", count: SlotMapper.slotCount)
            var labels = slugs
            for slot in newValue where (0..<SlotMapper.slotCount).contains(slot.index) {
                slugs[slot.index] = slot.slug
                labels[slot.index] = slot.label
            }
            defaults.set(slugs, forKey: Key.slotSlugs)
            defaults.set(labels, forKey: Key.slotLabels)
        }
    }

    func makeClient() -> APIClient? {
        let url = serverURL, token = apiToken
        guard !url.isEmpty, !token.isEmpty else { return nil }
        return APIClient(baseURL: url, token: token)
    }
}
