import AppKit
import UserNotifications

/// Error notifications, matching the GNOME extension's
/// "Server unreachable — could not <action>." messages.
@MainActor
enum Notifier {
    /// UNUserNotificationCenter crashes when the binary isn't inside an .app bundle
    /// (e.g. `swift run`), so fall back to a beep there.
    private static var isBundled: Bool { Bundle.main.bundleIdentifier != nil }

    static func setUp(delegate: UNUserNotificationCenterDelegate) {
        guard isBundled else { return }
        let center = UNUserNotificationCenter.current()
        center.delegate = delegate
        center.requestAuthorization(options: [.alert, .sound]) { _, error in
            if let error { NSLog("%@", "[work-tracker] Notification permission error: \(error)") }
        }
    }

    static func error(_ action: String, _ error: Error) {
        NSLog("%@", "[work-tracker] Could not \(action): \(error.localizedDescription)")
        guard isBundled else {
            NSSound.beep()
            return
        }
        let content = UNMutableNotificationContent()
        content.title = "Work Tracker"
        content.body = "Server unreachable — could not \(action)."
        content.sound = .default
        UNUserNotificationCenter.current().add(
            UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
    }
}
