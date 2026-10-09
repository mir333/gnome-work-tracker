# Work Tracker for macOS (menu bar)

A native menu bar app with the same features as the GNOME Shell extension:

```
 Acme  Beta  Internal  ✎  ■
```

| Item | Click | Same as GNOME |
|---|---|---|
| Project (up to 6, from your dashboard slots) | Start or switch tracking. Clicking the **active** (blue) project opens a *Started at HH:MM* editor | ✔ |
| ✎ | Add a note to the active work item | ✔ |
| ■ | Stop tracking. **Right-click** (or ⌃-click) opens the menu: Refresh Projects, Settings…, Quit | ✔ (the menu is macOS-only) |

Before it's configured, the app shows a single **⏱ Work Tracker** item: click it to open Settings, or right-click it to quit.

Buttons show the project's **short name** when one is set (web app → project → edit), otherwise its full name.

Other behaviour:
- **Auto-stop** when the screen locks or the Mac sleeps or shuts down (can be turned off in Settings).
- On launch, wake and unlock, the active project is synced from the server, so changes made in the web app show up.
- If a request fails, a notification shows *"Server unreachable — could not …"*.
- The items always appear in slot order, followed by ✎ and ■. (macOS has no left/center/right panel setting.)

## Requirements

- macOS 13 Ventura or later
- Xcode or the Command Line Tools (`xcode-select --install`) to build

## Build & install

```bash
./build-app.sh                # → build/WorkTracker.app (ad-hoc signed, this Mac's architecture)
./build-app.sh --install      # also copies it to /Applications
UNIVERSAL=1 ./build-app.sh    # Apple Silicon + Intel build (needs full Xcode)
```

On first launch the Settings window opens:

1. **Server URL**: e.g. `https://tracker.example.com`
2. **API Token**: from your profile page in the web app
3. Click **Save & Connect**. The project buttons appear in the menu bar.
4. Optionally enable **Launch at login**. This works best when the app is in `/Applications`.

The token is stored in the macOS Keychain. Everything else is stored in `UserDefaults`. Because the app is ad-hoc signed, macOS may ask after a rebuild whether it can read the Keychain item; choose *Always Allow*.

## Development

```bash
swift build          # debug build
swift test           # unit tests for WorkTrackerCore (API client, slot mapping, time parsing)
swift run            # runs unbundled; notifications fall back to a beep
```

Layout:

- `Sources/WorkTrackerCore/`: platform-independent logic. It contains the API client for the token endpoints (`/api/dashboard/:token`, `/api/status/:token`, `/api/trigger/:token/...`), the models, slot mapping and `HH:MM` parsing. It is unit-tested and also builds on Linux.
- `Sources/WorkTracker/`: the AppKit app, with status items, popovers, the settings window, lock/sleep hooks, Keychain storage and notifications.
