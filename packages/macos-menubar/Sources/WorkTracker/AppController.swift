import AppKit
import WorkTrackerCore

/// App state and behaviour — the macOS counterpart of the GNOME extension's
/// WorkTrackerBar + WorkTrackerExtension classes.
@MainActor
final class AppController {
    private let settings = SettingsStore()
    private let bar = StatusBarController()
    private var systemEvents: SystemEvents?

    private var slots: [Slot] = []
    private var activeItem: WorkItem?
    private var activeIndex: Int?

    private lazy var settingsWindow = SettingsWindowController(
        settings: settings,
        onConnect: { [weak self] in
            guard let self else { return .failure(CancellationError()) }
            return await self.refreshConfig()
        },
        onCredentialsCleared: { [weak self] in self?.credentialsCleared() }
    )

    func start() {
        // Render cached state immediately, then refresh from the server.
        slots = settings.slots
        activeIndex = settings.activeSlot >= 0 ? settings.activeSlot : nil

        bar.onProject = { [weak self] in self?.projectClicked($0) }
        bar.onNote = { [weak self] in self?.noteClicked() }
        bar.onStop = { [weak self] in self?.stop(action: "stop tracking") }
        bar.onRefresh = { [weak self] in
            Task { await self?.refreshConfig() }
        }
        bar.onSettings = { [weak self] in self?.settingsWindow.show() }
        rebuildBar()

        systemEvents = SystemEvents(
            onLockOrSleep: { [weak self] in self?.autoStop() },
            onWakeOrUnlock: { [weak self] in
                Task { await self?.syncActive() }
            }
        )

        if settings.makeClient() != nil {
            Task { await refreshConfig() }
        } else {
            settingsWindow.show()
        }
    }

    // MARK: - Config & state

    private func rebuildBar() {
        bar.rebuild(slots: slots, configured: settings.makeClient() != nil, activeIndex: activeIndex)
    }

    private func setActive(_ item: WorkItem?, index: Int?) {
        activeItem = item
        activeIndex = index
        settings.activeSlot = index ?? -1
        bar.setActive(index)
    }

    /// Fetches project slots (like GNOME's fetchAndStoreConfig) and the active work item.
    @discardableResult
    func refreshConfig() async -> Result<Int, Error> {
        guard let client = settings.makeClient() else {
            rebuildBar()
            return .failure(APIError.invalidURL)
        }
        do {
            let fetched = SlotMapper.slots(from: try await client.dashboard())
            // Rebuilding recreates the status items (and closes any open popover),
            // so only do it when the buttons actually changed.
            if fetched != slots || !bar.isShowingProjects {
                slots = fetched
                settings.slots = fetched
                rebuildBar()
            }
            await syncActive()
            return .success(fetched.count)
        } catch {
            NSLog("%@", "[work-tracker] Config fetch failed: \(error.localizedDescription)")
            rebuildBar()
            return .failure(error)
        }
    }

    /// The server is the source of truth (tracking may have changed from the web app).
    func syncActive() async {
        guard let client = settings.makeClient() else { return }
        do {
            let item = try await client.activeWorkItem()
            setActive(item, index: SlotMapper.activeIndex(in: slots, for: item))
        } catch {
            NSLog("%@", "[work-tracker] Status sync failed: \(error.localizedDescription)")
        }
    }

    private func credentialsCleared() {
        slots = []
        settings.slots = []
        setActive(nil, index: nil)
        rebuildBar()
    }

    // MARK: - Actions

    private func projectClicked(_ slot: Slot) {
        // Clicking the already-active project opens the start-time editor.
        if slot.index == activeIndex, let item = activeItem {
            showStartTimeEditor(slot: slot, item: item)
            return
        }
        guard let client = settings.makeClient() else { return }
        Task {
            do {
                let item = try await client.start(slug: slot.slug)
                setActive(item, index: slot.index)
            } catch {
                Notifier.error("start project", error)
            }
        }
    }

    private func showStartTimeEditor(slot: Slot, item: WorkItem) {
        let editor = InputPopoverController(
            label: "Started at:", initialText: TimeParser.hhmm(item.startedAt), placeholder: "HH:MM",
            buttonTitle: "Save", fieldWidth: 64
        ) { [weak self] text, popover in
            self?.saveStartTime(text, item: item, popover: popover)
        }
        bar.showPopover(editor, at: .slot(slot.index))
    }

    private func saveStartTime(_ text: String, item: WorkItem, popover: InputPopoverController) {
        guard let startedAt = TimeParser.todayAt(text) else {
            NSSound.beep() // invalid HH:MM — keep the popover open
            return
        }
        guard let client = settings.makeClient() else { return }
        popover.isBusy = true
        Task {
            defer { popover.isBusy = false }
            do {
                let updated = try await client.updateStart(workItemId: item.id, startedAt: startedAt)
                activeItem = updated ?? activeItem
                bar.closePopover()
            } catch {
                Notifier.error("update start time", error)
            }
        }
    }

    private func noteClicked() {
        guard activeItem != nil || activeIndex != nil else {
            NSLog("[work-tracker] No active work item, cannot add note")
            NSSound.beep()
            return
        }
        let noteEntry = InputPopoverController(
            label: "Note:", placeholder: "What are you working on?", buttonTitle: "Add", fieldWidth: 240
        ) { [weak self] text, popover in
            self?.saveNote(text, popover: popover)
        }
        bar.showPopover(noteEntry, at: .note)
    }

    private func saveNote(_ text: String, popover: InputPopoverController) {
        let note = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !note.isEmpty, let client = settings.makeClient() else { return }
        popover.isBusy = true
        Task {
            defer { popover.isBusy = false }
            do {
                try await client.addNote(note)
                bar.closePopover()
            } catch {
                Notifier.error("add note", error)
            }
        }
    }

    private func stop(action: String) {
        guard let client = settings.makeClient() else { return }
        Task {
            do {
                try await client.stop()
                setActive(nil, index: nil)
            } catch {
                Notifier.error(action, error)
            }
        }
    }

    private func autoStop() {
        guard settings.autoStopOnLock else { return }
        NSLog("[work-tracker] Screen locked / system sleeping, stopping tracker")
        stop(action: "stop tracking")
    }
}
