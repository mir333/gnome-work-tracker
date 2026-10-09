import AppKit
import WorkTrackerCore

/// Owns the menu bar items: one per project slot, then ✎ (note) and ■ (stop),
/// mirroring the GNOME panel buttons. Right-click (or ⌃-click) on ■ opens the app menu.
@MainActor
final class StatusBarController: NSObject {
    enum Anchor {
        case slot(Int)
        case note
    }

    var onProject: ((Slot) -> Void)?
    var onNote: (() -> Void)?
    var onStop: (() -> Void)?
    var onRefresh: (() -> Void)?
    var onSettings: (() -> Void)?

    private var projectItems: [(slot: Slot, item: NSStatusItem)] = []
    private var noteItem: NSStatusItem?
    private var stopItem: NSStatusItem?
    private var setupItem: NSStatusItem?
    private var popover: NSPopover?

    /// True when the configured layout (projects + ✎ + ■) is shown.
    var isShowingProjects: Bool { stopItem != nil }

    // Colors from the GNOME extension's stylesheet.
    private static let activeBackground = NSColor(srgbRed: 53 / 255, green: 132 / 255, blue: 228 / 255, alpha: 0.85)
    private static let stopColor = NSColor(srgbRed: 246 / 255, green: 97 / 255, blue: 81 / 255, alpha: 0.9)
    private static var boldFont: NSFont {
        NSFontManager.shared.convert(NSFont.menuBarFont(ofSize: 0), toHaveTrait: .boldFontMask)
    }

    // MARK: - Building

    func rebuild(slots: [Slot], configured: Bool, activeIndex: Int?) {
        removeAll()

        guard configured else {
            // Without credentials there is nothing to show — offer a way into Settings.
            let item = makeItem(action: #selector(setupClicked))
            item.button?.title = "⏱ Work Tracker"
            item.button?.toolTip = "Open Work Tracker settings (right-click for menu)"
            item.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])
            setupItem = item
            return
        }

        // New status items appear to the LEFT of existing ones, so create right-to-left:
        // ■, ✎, then slots 6…1 — giving [1 2 3 4 5 6 ✎ ■] like the GNOME panel.
        // (No autosaveName: restored positions would override this order when slots change.)
        let stop = makeItem(action: #selector(stopClicked))
        stop.button?.attributedTitle = NSAttributedString(
            string: "\u{25A0}", attributes: [.font: Self.boldFont, .foregroundColor: Self.stopColor])
        stop.button?.toolTip = "Stop tracking (right-click for menu)"
        stop.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])
        stopItem = stop

        let note = makeItem(action: #selector(noteClicked))
        note.button?.title = "\u{270E}"
        note.button?.font = Self.boldFont
        note.button?.toolTip = "Add a note to the active work item"
        noteItem = note

        for slot in slots.reversed() {
            let item = makeItem(action: #selector(projectClicked(_:)))
            item.button?.tag = slot.index
            projectItems.insert((slot, item), at: 0)
        }
        setActive(activeIndex)
    }

    func setActive(_ index: Int?) {
        for (slot, item) in projectItems {
            guard let button = item.button else { continue }
            if slot.index == index {
                // Drawn "pill" (blue background, white text) like GNOME's .work-tracker-active.
                // An image renders reliably; the status button's own layer is managed by AppKit.
                button.title = ""
                button.image = Self.pillImage(slot.label)
            } else {
                button.image = nil
                button.title = slot.label // system picks the right menu bar text color
                button.font = Self.boldFont
            }
        }
    }

    private static func pillImage(_ text: String) -> NSImage {
        let attributes: [NSAttributedString.Key: Any] = [.font: boldFont, .foregroundColor: NSColor.white]
        let textSize = (text as NSString).size(withAttributes: attributes)
        let padding: CGFloat = 8
        let height = max(NSStatusBar.system.thickness - 4, ceil(textSize.height) + 2)
        let size = NSSize(width: ceil(textSize.width) + padding * 2, height: height)
        let background = activeBackground
        let image = NSImage(size: size, flipped: false) { rect in
            background.setFill()
            NSBezierPath(roundedRect: rect, xRadius: 4, yRadius: 4).fill()
            let origin = NSPoint(x: padding, y: (rect.height - textSize.height) / 2)
            (text as NSString).draw(at: origin, withAttributes: attributes)
            return true
        }
        image.isTemplate = false
        return image
    }

    private func makeItem(action: Selector) -> NSStatusItem {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = item.button {
            button.target = self
            button.action = action
        }
        return item
    }

    private func removeAll() {
        closePopover()
        let items = projectItems.map { $0.item } + [noteItem, stopItem, setupItem].compactMap { $0 }
        for item in items { NSStatusBar.system.removeStatusItem(item) }
        projectItems = []
        noteItem = nil
        stopItem = nil
        setupItem = nil
    }

    // MARK: - Popovers

    func showPopover(_ controller: NSViewController, at anchor: Anchor) {
        closePopover()
        let button: NSStatusBarButton?
        switch anchor {
        case let .slot(index): button = projectItems.first { $0.slot.index == index }?.item.button
        case .note: button = noteItem?.button
        }
        guard let button else { return }

        let popover = NSPopover()
        popover.behavior = .transient
        popover.contentViewController = controller
        NSApp.activate(ignoringOtherApps: true) // needed for keyboard focus in an accessory app
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        self.popover = popover
    }

    func closePopover() {
        popover?.performClose(nil)
        popover = nil
    }

    // MARK: - Actions

    private var isMenuClick: Bool {
        let event = NSApp.currentEvent
        return event?.type == .rightMouseUp || event?.modifierFlags.contains(.control) == true
    }

    @objc private func projectClicked(_ sender: NSStatusBarButton) {
        guard let entry = projectItems.first(where: { $0.slot.index == sender.tag }) else { return }
        onProject?(entry.slot)
    }

    @objc private func noteClicked() { onNote?() }

    @objc private func settingsClicked() { onSettings?() }

    @objc private func refreshClicked() { onRefresh?() }

    @objc private func setupClicked() {
        if isMenuClick, let setupItem {
            showAppMenu(on: setupItem)
        } else {
            onSettings?()
        }
    }

    @objc private func stopClicked() {
        if isMenuClick, let stopItem {
            showAppMenu(on: stopItem)
        } else {
            onStop?()
        }
    }

    private func showAppMenu(on item: NSStatusItem) {
        let menu = NSMenu()
        if isShowingProjects {
            menu.addItem(withTitle: "Refresh Projects", action: #selector(refreshClicked), keyEquivalent: "r").target = self
        }
        menu.addItem(withTitle: "Settings…", action: #selector(settingsClicked), keyEquivalent: ",").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Work Tracker", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        // Temporarily attach the menu so it opens anchored to the item.
        item.menu = menu
        item.button?.performClick(nil)
        item.menu = nil
    }
}
