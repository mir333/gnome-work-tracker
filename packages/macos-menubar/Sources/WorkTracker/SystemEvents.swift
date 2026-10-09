import AppKit

/// Screen lock / sleep / power-off → auto-stop; wake / unlock → resync.
/// macOS equivalent of the GNOME extension's screenShield + prepare-for-sleep hooks.
@MainActor
final class SystemEvents {
    private var observers: [(NotificationCenter, NSObjectProtocol)] = []

    init(onLockOrSleep: @escaping @MainActor () -> Void, onWakeOrUnlock: @escaping @MainActor () -> Void) {
        let distributed = DistributedNotificationCenter.default()
        let workspace = NSWorkspace.shared.notificationCenter

        observe(distributed, Notification.Name("com.apple.screenIsLocked"), onLockOrSleep)
        observe(workspace, NSWorkspace.willSleepNotification, onLockOrSleep)
        observe(workspace, NSWorkspace.willPowerOffNotification, onLockOrSleep)

        observe(distributed, Notification.Name("com.apple.screenIsUnlocked"), onWakeOrUnlock)
        observe(workspace, NSWorkspace.didWakeNotification, onWakeOrUnlock)
    }

    private func observe(_ center: NotificationCenter, _ name: Notification.Name, _ handler: @escaping @MainActor () -> Void) {
        let token = center.addObserver(forName: name, object: nil, queue: .main) { _ in
            Task { @MainActor in handler() }
        }
        observers.append((center, token))
    }
}
