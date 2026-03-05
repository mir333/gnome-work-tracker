# Edit Start Time Popup on Active Project

## Problem

Users sometimes forget to start tracking or start late. There is no way to correct the start time from the GNOME extension — you must open the web app. We want a quick way to edit the start time directly from the panel.

## Solution

When a user clicks an **already-active** project button in the GNOME extension, a native GNOME dropdown popup appears below the button. It shows the current start time as HH:MM, lets the user edit it, and saves on confirmation. Clicking an **inactive** project still triggers it normally (no popup).

## Backend

The existing `PUT /api/work-items/:id` uses session auth (cookies). The GNOME extension uses API tokens. A new token-based endpoint is needed:

```
PUT /api/trigger/:apiToken/work-items/:id
Body: { "startedAt": "2026-03-05T09:30:00" }
Response: { ok: true, workItem: {...} }
```

This reuses `workItemService.update()` with token-based auth via `triggerService.resolveToken()`.

## Extension

### Behavior

- Click **inactive** button: trigger project (existing behavior, unchanged)
- Click **active** button: open dropdown popup with HH:MM entry and Save button
- Edit time, click Save: send PUT request, close popup
- Click outside or press Escape: close popup without saving

### UI Components

- `PopupMenu.PopupMenu` attached to the active project button
- Inside: a label ("Started at:"), an `St.Entry` pre-filled with current HH:MM, and a Save `St.Button`
- GNOME handles click-outside-to-close and Escape key automatically

### Data Flow

1. Trigger API already returns `workItem` with `id` and `startedAt` — store on the bar when project becomes active
2. When popup opens, format stored `startedAt` as HH:MM and pre-fill the entry
3. On save, combine today's date with the new HH:MM, send to update endpoint
4. On success, update stored `startedAt` and close popup

### Styles

- `work-tracker-popup` class for the popup container
- Entry and Save button styled to match extension look

## What Stays the Same

- Stop button behavior
- Auto-stop on lock/suspend
- Settings/preferences
- Config sync
- Inactive button click behavior
