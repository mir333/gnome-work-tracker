# Add Description to Active Task

## Problem

Users need the ability to add descriptive notes to a currently running work item. This is independent of start/stop functionality — it's a separate action that appends text to the active task's description field.

## Design

### Backend

**New endpoints:**

| Route | Auth | Method | Purpose |
|---|---|---|---|
| `/api/work-items/active/description` | Session | POST | Append description to active work item |
| `/api/trigger/:apiToken/active/description` | Token | POST | Append description to active work item |

**Request body:** `{ "description": "some text" }`

**Append logic:** If the work item already has a description, the new text is appended with a newline separator. Otherwise, the new text becomes the description.

```
newDescription = existing.description
  ? existing.description + "\n" + input.description
  : input.description
```

**Responses:**
- `200 { ok: true, workItem }` — success
- `400 { error: "No active work item" }` — no task in progress
- `400 { error: "Description is required" }` — empty/missing text

**Files:**
- `work-item.service.ts` — new `appendDescription(userId, description)` method
- `work-items.ts` (routes) — new session-auth route
- `trigger.ts` (routes) — new token-auth route

### Web Frontend — Dashboard

- "Add Note" button appears below the Stop Tracking button, only when a task is active and viewing today
- Clicking toggles open an inline textarea with a "Save" button
- On save: `POST /api/work-items/active/description`, clear textarea, collapse area
- If API returns "No active work item" error, show inline error message
- Completely independent from start/stop — no side effects on tracking state

**New state:** `noteOpen`, `noteText`, `noteSaving`

### Web Frontend — Launcher

- Same pattern as dashboard: "Add Note" button below Stop Tracking
- Only visible when `status.active` is truthy
- Expands textarea + Save on click

### GNOME Extension

- New icon button in the panel bar (next to the Stop button) for adding notes
- Stop button text "Stop" replaced with a stop icon (Unicode ■ or similar)
- Note button uses a note/pencil icon (Unicode ✎ or similar)
- Clicking the note icon opens a popup with a text entry and "Add Note" save button
- Calls `POST /api/trigger/:apiToken/active/description`
- If no active work item, API returns 400 and extension logs the error
- Button is always visible but only functional when a task is active

### Error Handling

- **No active task:** Backend returns 400. Web shows inline error below textarea. GNOME extension logs error.
- **Empty description:** Disabled Save button on frontend; backend validates and returns 400.
- **Network error:** Handled by existing error handling in `api.ts` and GNOME extension HTTP helpers.

### No Impact on Start/Stop

This feature has zero implications on start/stop functionality. The description endpoint is a standalone call that happens to target the currently active work item. Start and stop continue to work exactly as before.
