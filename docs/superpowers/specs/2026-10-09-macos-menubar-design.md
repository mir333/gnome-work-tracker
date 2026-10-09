# macOS Menu Bar App + Project Short Names: Design

## Goal

Give macOS users the same one-click project switching that the GNOME Shell extension provides, and add an optional project **short name** so that desktop panel buttons take up less space.

## Decisions (agreed in brainstorming)

| Question | Decision |
|---|---|
| Kind of "widget" | Menu bar app (not WidgetKit). It supports text input (notes, start time) and lock/sleep hooks |
| Stack | Native Swift and AppKit, built with Swift Package Manager, macOS 13+, no Xcode project, no dependencies |
| Layout | Literal GNOME parity: one `NSStatusItem` per project slot, then ✎ and ■ |
| Panel space | New optional `Project.shortName` (max 12 characters). Clients show `shortName ‖ name` |
| GNOME | Also uses the short name |
| Settings and Quit access | Right-click or ⌃-click on ■ |

## Server

- Migration: `Project.shortName TEXT NULL`.
- `projectService.normalizeShortName`: `undefined` means not provided, empty or whitespace means `null`, anything else is trimmed and must be ≤ 12 characters (otherwise 400).
- `POST /api/projects` and `PUT /api/projects/:id` accept `shortName`. Update now forwards only `name`, `slug` and `shortName` to Prisma.
- `GET /api/dashboard/:token` adds `projectShortName`. The change is additive, so older clients are unaffected.

## Web

The project create and edit dialogs (projects list and project detail) get an optional "Short Name" input. The projects table shows the short name next to the name.

## GNOME extension

`labels[i] = item.projectShortName || item.projectName || ""` in both `extension.js` and `prefs.js`.

## macOS app (`packages/macos-menubar`)

- **WorkTrackerCore** (pure Foundation, unit-tested, builds on Linux): `APIClient` (the token endpoints, ISO-8601 dates with milliseconds, percent-encoded path segments, 10 s timeout), `SlotMapper` (dashboard → ordered slots, label fallback, active slot by slug), `TimeParser` (`H:MM`/`HH:MM` → today; same validation as GNOME).
- **WorkTracker** (AppKit):
  - `StatusBarController`: creates the items right-to-left so the order is `[1…6 ✎ ■]`. There is no `autosaveName`, so the order is fixed. The active project is drawn as a blue pill with white text and ■ is red, like the GNOME stylesheet. Before credentials are set, a single "⏱ Work Tracker" item opens Settings, and right-clicking it opens the menu. Items are rebuilt only when the slots change.
  - `InputPopoverController`: the "Started at" and "Note" popovers. Return submits, and input is disabled while a request is in flight.
  - `AppController`:
    - Behaviour matches GNOME: start/switch, click active → edit start, note, stop, auto-stop.
    - Additionally, it syncs the active item from `/api/status/:token` on launch, connect, wake and unlock.
  - `SettingsWindowController`: Server URL, API token, Save & Connect, Clear Credentials, auto-stop toggle, Launch at login (`SMAppService`).
  - `SettingsStore`: `UserDefaults` for settings, Keychain for the token (cached in memory to avoid repeated access prompts).
  - `SystemEvents`: `com.apple.screenIsLocked`, `willSleep` and `willPowerOff` trigger a stop when auto-stop is enabled.
  - `Notifier`: on error shows "Server unreachable — could not …" via `UNUserNotificationCenter` (falls back to a beep when running unbundled).
- `build-app.sh`: release build → `WorkTracker.app` (`LSUIElement`, ad-hoc signed). `UNIVERSAL=1` builds for both architectures (needs full Xcode) and `--install` copies the app to /Applications.

## Testing

- Server: Bun tests for `normalizeShortName`, project create/update, and `toTokenSlots`.
- macOS: XCTest for `WorkTrackerCore` (`swift test`).
- The AppKit layer needs a manual check on a Mac:
  - The items appear in the order `[1…6 ✎ ■]`.
  - Start, switch and stop work, and the active project is highlighted.
  - Editing the start time and adding a note work.
  - Right-click on ■ opens the menu.
  - Locking the screen stops tracking.
  - The settings round-trip works and Launch at login works.

## Out of scope

WidgetKit widget, Developer ID signing and notarization, auto-update.
