import AppKit
import ServiceManagement

/// Settings window — same options as the GNOME prefs (minus panel position, which
/// macOS doesn't offer), plus "Launch at login".
@MainActor
final class SettingsWindowController: NSWindowController {
    private let settings: SettingsStore
    private let onConnect: () async -> Result<Int, Error>
    private let onCredentialsCleared: () -> Void

    private let urlField = NSTextField(string: "")
    private let tokenField = NSSecureTextField(string: "")
    private let statusLabel = NSTextField(labelWithString: "")
    private lazy var autoStopCheckbox = NSButton(
        checkboxWithTitle: "Auto-stop tracking when the screen locks or the Mac sleeps",
        target: self, action: #selector(autoStopToggled))
    private lazy var launchAtLoginCheckbox = NSButton(
        checkboxWithTitle: "Launch at login", target: self, action: #selector(launchAtLoginToggled))

    init(
        settings: SettingsStore,
        onConnect: @escaping () async -> Result<Int, Error>,
        onCredentialsCleared: @escaping () -> Void
    ) {
        self.settings = settings
        self.onConnect = onConnect
        self.onCredentialsCleared = onCredentialsCleared
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 480, height: 240),
            styleMask: [.titled, .closable], backing: .buffered, defer: true)
        window.title = "Work Tracker Settings"
        window.isReleasedWhenClosed = false
        super.init(window: window)
        buildContent()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func show() {
        urlField.stringValue = settings.serverURL
        tokenField.stringValue = settings.apiToken
        autoStopCheckbox.state = settings.autoStopOnLock ? .on : .off
        syncLaunchAtLoginCheckbox()
        statusLabel.stringValue = ""
        NSApp.activate(ignoringOtherApps: true)
        window?.center()
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
    }

    private func buildContent() {
        urlField.placeholderString = "https://tracker.example.com"
        tokenField.placeholderString = "API token from your profile page"
        for field in [urlField, tokenField] as [NSTextField] {
            field.translatesAutoresizingMaskIntoConstraints = false
            field.widthAnchor.constraint(equalToConstant: 320).isActive = true
        }
        statusLabel.textColor = .secondaryLabelColor
        // Error bodies can be long (e.g. proxy HTML pages) — never let them widen the window.
        statusLabel.lineBreakMode = .byTruncatingTail
        statusLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.widthAnchor.constraint(lessThanOrEqualToConstant: 320).isActive = true

        let saveButton = NSButton(title: "Save & Connect", target: self, action: #selector(saveAndConnect))
        saveButton.keyEquivalent = "\r"
        let clearButton = NSButton(title: "Clear Credentials", target: self, action: #selector(clearCredentials))
        let buttons = NSStackView(views: [saveButton, clearButton])
        buttons.spacing = 8

        let grid = NSGridView(views: [
            [NSTextField(labelWithString: "Server URL:"), urlField],
            [NSTextField(labelWithString: "API Token:"), tokenField],
            [NSGridCell.emptyContentView, buttons],
            [NSGridCell.emptyContentView, statusLabel],
            [NSGridCell.emptyContentView, autoStopCheckbox],
            [NSGridCell.emptyContentView, launchAtLoginCheckbox],
        ])
        grid.column(at: 0).xPlacement = .trailing
        grid.rowAlignment = .firstBaseline
        grid.rowSpacing = 10
        grid.columnSpacing = 8
        grid.translatesAutoresizingMaskIntoConstraints = false

        let content = NSView()
        content.addSubview(grid)
        NSLayoutConstraint.activate([
            grid.topAnchor.constraint(equalTo: content.topAnchor, constant: 20),
            grid.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -20),
            grid.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 20),
            grid.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -20),
        ])
        window?.contentView = content
    }

    // MARK: - Actions

    @objc private func saveAndConnect() {
        let url = urlField.stringValue.trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: "/+$", with: "", options: .regularExpression)
        let token = tokenField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !url.isEmpty, !token.isEmpty else {
            statusLabel.stringValue = "Enter both the server URL and the API token."
            return
        }
        urlField.stringValue = url
        settings.serverURL = url
        settings.apiToken = token

        statusLabel.stringValue = "Fetching…"
        Task {
            switch await onConnect() {
            case let .success(count):
                statusLabel.stringValue = "Connected — \(count) project(s) loaded"
            case let .failure(error):
                statusLabel.stringValue = "Error: \(error.localizedDescription)"
            }
        }
    }

    @objc private func clearCredentials() {
        settings.serverURL = ""
        settings.apiToken = ""
        urlField.stringValue = ""
        tokenField.stringValue = ""
        statusLabel.stringValue = "Credentials removed."
        onCredentialsCleared()
    }

    @objc private func autoStopToggled() {
        settings.autoStopOnLock = autoStopCheckbox.state == .on
    }

    @objc private func launchAtLoginToggled() {
        do {
            if launchAtLoginCheckbox.state == .on {
                try SMAppService.mainApp.register()
                if SMAppService.mainApp.status == .requiresApproval {
                    statusLabel.stringValue = "Approve Work Tracker in System Settings → Login Items."
                    SMAppService.openSystemSettingsLoginItems()
                }
            } else {
                try SMAppService.mainApp.unregister()
            }
        } catch {
            statusLabel.stringValue = "Launch at login: \(error.localizedDescription)"
        }
        syncLaunchAtLoginCheckbox()
    }

    private func syncLaunchAtLoginCheckbox() {
        launchAtLoginCheckbox.state = SMAppService.mainApp.status == .enabled ? .on : .off
    }
}
