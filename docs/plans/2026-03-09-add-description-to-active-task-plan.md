# Add Description to Active Task — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to append descriptive notes to the currently running work item from the dashboard, launcher, and GNOME extension — independent of start/stop.

**Architecture:** New `POST` endpoints (session + token auth) find the active work item and append the description with newline separator. Frontend adds an expandable "Add Note" area below the stop button. GNOME extension adds an icon button that opens a note popup.

**Tech Stack:** Hono (backend), React + Tailwind (web), GJS/St (GNOME extension)

---

### Task 1: Backend — Service method `appendDescription`

**Files:**
- Modify: `packages/server/src/services/work-item.service.ts`

**Step 1: Add `appendDescription` method**

Add this method to the `workItemService` object in `work-item.service.ts`:

```ts
async appendDescription(userId: string, description: string) {
  const active = await workItemRepository.findActiveByUser(userId);
  if (!active) return null;

  const newDescription = active.description
    ? active.description + "\n" + description
    : description;

  return workItemRepository.update(active.id, { description: newDescription });
},
```

**Step 2: Verify server compiles**

Run: `cd /workspace/miro/gnome-work-tracker && bun run --hot packages/server/src/index.ts &` then kill it.
Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add packages/server/src/services/work-item.service.ts
git commit -m "feat: add appendDescription method to work item service"
```

---

### Task 2: Backend — Session-auth route

**Files:**
- Modify: `packages/server/src/routes/work-items.ts`

**Step 1: Add POST route for session-based description append**

Add this route to `work-items.ts` (after the existing routes, before the `export`):

```ts
workItems.post("/work-items/active/description", async (c) => {
  const userId = c.get("userId");
  const { description } = await c.req.json();
  if (!description || !description.trim()) {
    return c.json({ error: "Description is required" }, 400);
  }
  const workItem = await workItemService.appendDescription(userId, description.trim());
  if (!workItem) {
    return c.json({ error: "No active work item" }, 400);
  }
  return c.json({ ok: true, workItem });
});
```

**Important:** This route must be placed BEFORE the `workItems.put("/work-items/:id", ...)` route, otherwise `/work-items/active/description` would match `:id` as `"active"`. Check the route ordering — Hono matches in definition order. The route with `"active"` literal segment must come first.

Actually, looking at the route structure more carefully: the POST method won't conflict with the PUT `/:id` route because they use different HTTP methods. However, if there's a `delete` or other route with `/work-items/:id` pattern as POST, we need to be careful. In this case, there's no POST on `/work-items/:id`, so ordering is fine. Add it after the existing routes.

**Step 2: Verify server compiles**

Run: `cd /workspace/miro/gnome-work-tracker && bun build packages/server/src/index.ts --no-bundle 2>&1 | head -20`
Expected: No errors.

**Step 3: Commit**

```bash
git add packages/server/src/routes/work-items.ts
git commit -m "feat: add session-auth endpoint for appending description to active work item"
```

---

### Task 3: Backend — Token-auth route

**Files:**
- Modify: `packages/server/src/routes/trigger.ts`

**Step 1: Add POST route for token-based description append**

Add this route to `trigger.ts` (after the existing PUT route for work items, before the `export`):

```ts
trigger.post("/:apiToken/active/description", async (c) => {
  const profile = await triggerService.resolveToken(c.req.param("apiToken"));
  if (!profile) return c.json({ error: "Invalid token" }, 401);

  const { description } = await c.req.json();
  if (!description || !description.trim()) {
    return c.json({ error: "Description is required" }, 400);
  }

  const workItem = await workItemService.appendDescription(profile.userId, description.trim());
  if (!workItem) {
    return c.json({ error: "No active work item" }, 400);
  }
  return c.json({ ok: true, workItem });
});
```

Also add the import for `workItemService` at the top of `trigger.ts`:

```ts
import { workItemService } from "../services/work-item.service";
```

Note: Check if this import already exists. Currently `trigger.ts` only imports from `triggerService`. The `workItemService` import is new.

**Step 2: Verify server compiles**

Run: `cd /workspace/miro/gnome-work-tracker && bun build packages/server/src/index.ts --no-bundle 2>&1 | head -20`
Expected: No errors.

**Step 3: Commit**

```bash
git add packages/server/src/routes/trigger.ts
git commit -m "feat: add token-auth endpoint for appending description to active work item"
```

---

### Task 4: Web Frontend — Dashboard "Add Note" expandable area

**Files:**
- Modify: `packages/web/src/pages/dashboard.tsx`

**Step 1: Add state variables**

In the `DashboardPage` component, add these state variables alongside the existing ones:

```tsx
const [noteOpen, setNoteOpen] = useState(false);
const [noteText, setNoteText] = useState("");
const [noteSaving, setNoteSaving] = useState(false);
const [noteError, setNoteError] = useState("");
```

**Step 2: Add the `addNote` handler function**

Add this alongside the existing action functions (`triggerProject`, `stopAll`, etc.):

```tsx
async function addNote() {
  if (!noteText.trim()) return;
  setNoteSaving(true);
  setNoteError("");
  try {
    await api.post("/work-items/active/description", { description: noteText.trim() });
    setNoteText("");
    setNoteOpen(false);
  } catch (e: any) {
    setNoteError(e.message || "Failed to add note");
  } finally {
    setNoteSaving(false);
  }
}
```

**Step 3: Add the UI below the Stop Tracking button**

Find the Stop Tracking `<Button>` in the day view section (inside the `{isToday && ( ... )}` block). After the Stop button and before the closing `</>` of the `isToday` block, add:

```tsx
{/* Add Note */}
{active && (
  <div className="mb-6">
    <Button
      variant="outline"
      className="w-full"
      onClick={() => { setNoteOpen(!noteOpen); setNoteError(""); }}
    >
      Add Note
    </Button>
    {noteOpen && (
      <div className="mt-2 space-y-2">
        <textarea
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          rows={3}
          placeholder="What are you working on?"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
        />
        {noteError && (
          <p className="text-sm text-destructive">{noteError}</p>
        )}
        <Button
          size="sm"
          onClick={addNote}
          disabled={!noteText.trim() || noteSaving}
        >
          {noteSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    )}
  </div>
)}
```

**Important:** The `mb-6` on the Stop button should be moved/adjusted. Currently the Stop button has `className="w-full mb-6"`. Remove `mb-6` from the Stop button and instead wrap the Stop + Add Note in a container, OR keep `mb-6` on the Stop button and add no top margin on the Add Note section. The cleanest approach: remove `mb-6` from the Stop button, wrap Stop + Add Note area in a `<div className="mb-6 space-y-2">`.

So the full replacement of the Stop button section becomes:

```tsx
{/* Stop + Add Note */}
<div className="mb-6 space-y-2">
  <Button
    variant="destructive"
    className="w-full"
    onClick={stopAll}
    disabled={!active}
  >
    <Square className="mr-2 h-4 w-4" />
    Stop Tracking
  </Button>

  {active && (
    <>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => { setNoteOpen(!noteOpen); setNoteError(""); }}
      >
        Add Note
      </Button>
      {noteOpen && (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
            placeholder="What are you working on?"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          {noteError && (
            <p className="text-sm text-destructive">{noteError}</p>
          )}
          <Button
            size="sm"
            onClick={addNote}
            disabled={!noteText.trim() || noteSaving}
          >
            {noteSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      )}
    </>
  )}
</div>
```

**Step 4: Verify frontend compiles**

Run: `cd /workspace/miro/gnome-work-tracker/packages/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

**Step 5: Commit**

```bash
git add packages/web/src/pages/dashboard.tsx
git commit -m "feat: add expandable 'Add Note' area to dashboard page"
```

---

### Task 5: Web Frontend — Launcher "Add Note" expandable area

**Files:**
- Modify: `packages/web/src/pages/launcher.tsx`

**Step 1: Add state variables**

In the `LauncherPage` component, add these state variables:

```tsx
const [noteOpen, setNoteOpen] = useState(false);
const [noteText, setNoteText] = useState("");
const [noteSaving, setNoteSaving] = useState(false);
const [noteError, setNoteError] = useState("");
```

**Step 2: Add the `addNote` handler function**

```tsx
async function addNote() {
  if (!noteText.trim()) return;
  setNoteSaving(true);
  setNoteError("");
  try {
    await api.post("/work-items/active/description", { description: noteText.trim() });
    setNoteText("");
    setNoteOpen(false);
  } catch (e: any) {
    setNoteError(e.message || "Failed to add note");
  } finally {
    setNoteSaving(false);
  }
}
```

**Step 3: Add the UI below the Stop Tracking button**

Replace the current Stop button section:

```tsx
{/* Stop */}
<Button
  variant="destructive"
  className="w-full mb-8"
  onClick={stopAll}
  disabled={!status.active}
>
  <Square className="mr-2 h-4 w-4" />
  Stop Tracking
</Button>
```

With:

```tsx
{/* Stop + Add Note */}
<div className="mb-8 space-y-2">
  <Button
    variant="destructive"
    className="w-full"
    onClick={stopAll}
    disabled={!status.active}
  >
    <Square className="mr-2 h-4 w-4" />
    Stop Tracking
  </Button>

  {status.active && (
    <>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => { setNoteOpen(!noteOpen); setNoteError(""); }}
      >
        Add Note
      </Button>
      {noteOpen && (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
            placeholder="What are you working on?"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          {noteError && (
            <p className="text-sm text-destructive">{noteError}</p>
          )}
          <Button
            size="sm"
            onClick={addNote}
            disabled={!noteText.trim() || noteSaving}
          >
            {noteSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      )}
    </>
  )}
</div>
```

**Step 4: Verify frontend compiles**

Run: `cd /workspace/miro/gnome-work-tracker/packages/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

**Step 5: Commit**

```bash
git add packages/web/src/pages/launcher.tsx
git commit -m "feat: add expandable 'Add Note' area to launcher page"
```

---

### Task 6: GNOME Extension — Replace Stop text with icon, add Note icon button

**Files:**
- Modify: `packages/gnome-extension/extension.js`
- Modify: `packages/gnome-extension/stylesheet.css`

**Step 1: Add `httpPost` helper function**

In `extension.js`, add this function after the existing `httpPut` function:

```js
function httpPost(url, body, callback) {
  console.log(`[work-tracker] POST ${url}`);
  const message = Soup.Message.new("POST", url);
  if (!message) {
    console.error(`[work-tracker] Invalid URL: ${url}`);
    callback(new Error(`Invalid URL: ${url}`), null);
    return;
  }
  const bodyStr = JSON.stringify(body);
  const bytes = GLib.Bytes.new(new TextEncoder().encode(bodyStr));
  message.set_request_body_from_bytes("application/json", bytes);
  _session.send_and_read_async(
    message,
    GLib.PRIORITY_DEFAULT,
    null,
    (session, result) => {
      try {
        const responseBytes = session.send_and_read_finish(result);
        const statusCode = message.get_status();
        const responseBody = new TextDecoder().decode(responseBytes.get_data());
        console.log(`[work-tracker] Response ${statusCode}: ${responseBody}`);
        if (statusCode !== Soup.Status.OK) {
          callback(new Error(`HTTP ${statusCode}: ${responseBody}`), null);
          return;
        }
        callback(null, JSON.parse(responseBody));
      } catch (e) {
        console.error(`[work-tracker] Request error: ${e.message}`);
        callback(e, null);
      }
    }
  );
}
```

**Step 2: Replace Stop button text with icon, add Note icon button**

In the `_buildButtons()` method, replace the stop button creation block:

```js
const stopBtn = new St.Button({
  label: "Stop",
  style_class: "work-tracker-button work-tracker-stop panel-button",
  can_focus: true,
  track_hover: true,
});
stopBtn.connect("clicked", () => this._onStopClicked());
this.add_child(stopBtn);
```

With:

```js
// Note button (pencil icon ✎)
const noteBtn = new St.Button({
  label: "\u270E",
  style_class: "work-tracker-button work-tracker-note panel-button",
  can_focus: true,
  track_hover: true,
});
noteBtn.connect("clicked", () => this._onNoteClicked());
this.add_child(noteBtn);

// Stop button (square icon ■)
const stopBtn = new St.Button({
  label: "\u25A0",
  style_class: "work-tracker-button work-tracker-stop panel-button",
  can_focus: true,
  track_hover: true,
});
stopBtn.connect("clicked", () => this._onStopClicked());
this.add_child(stopBtn);
```

**Step 3: Add `_onNoteClicked` method**

Add this method to the `WorkTrackerBar` class, after `_onStopClicked`:

```js
_onNoteClicked() {
  const currentActive = this._settings.get_int("active-slot");
  if (currentActive < 0 || !this._activeWorkItem) {
    console.log("[work-tracker] No active work item, cannot add note");
    return;
  }
  this._showNotePopup();
}
```

**Step 4: Add `_showNotePopup` method**

Add this method after `_onNoteClicked`:

```js
_showNotePopup() {
  // Close any existing popup
  if (this._editPopup) {
    this._editPopup.close();
    this._editPopup.destroy();
    this._editPopup = null;
  }

  // Find any active button to anchor the popup
  const activeSlot = this._settings.get_int("active-slot");
  const entry = this._buttons.find((b) => b.index === activeSlot);
  if (!entry) return;

  // Create popup menu anchored to the button
  const popup = new PopupMenu.PopupMenu(entry.button, 0.0, St.Side.TOP);
  Main.uiGroup.add_child(popup.actor);
  popup.actor.add_style_class_name("work-tracker-popup");

  // Create a custom menu item with note UI
  const item = new PopupMenu.PopupBaseMenuItem({ reactive: false });

  const box = new St.BoxLayout({
    vertical: false,
    style_class: "work-tracker-edit-box",
  });

  const label = new St.Label({
    text: "Note:",
    y_align: Clutter.ActorAlign.CENTER,
    style_class: "work-tracker-edit-label",
  });
  box.add_child(label);

  const noteEntry = new St.Entry({
    hint_text: "What are you working on?",
    style_class: "work-tracker-note-entry",
    can_focus: true,
  });
  box.add_child(noteEntry);

  const saveBtn = new St.Button({
    label: "Add",
    style_class: "work-tracker-edit-save",
    can_focus: true,
  });
  saveBtn.connect("clicked", () => {
    this._saveNote(noteEntry.get_text(), popup);
  });
  box.add_child(saveBtn);

  item.add_child(box);
  popup.addMenuItem(item);

  // Open the popup
  popup.open();

  // Focus the entry after opening
  GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
    noteEntry.grab_key_focus();
    return GLib.SOURCE_REMOVE;
  });

  this._editPopup = popup;
}
```

**Step 5: Add `_saveNote` method**

Add this method after `_showNotePopup`:

```js
_saveNote(text, popup) {
  if (!text || !text.trim()) {
    console.log("[work-tracker] Empty note, ignoring");
    return;
  }

  const apiToken = this._settings.get_string("api-token");
  const serverUrl = this._settings.get_string("server-url");
  const url = `${serverUrl}/api/trigger/${apiToken}/active/description`;

  httpPost(url, { description: text.trim() }, (err, _data) => {
    if (err) {
      console.error(`[work-tracker] Add note failed: ${err.message}`);
      return;
    }
    popup.close();
    popup.destroy();
    this._editPopup = null;
  });
}
```

**Step 6: Add CSS for the note entry**

In `stylesheet.css`, add:

```css
.work-tracker-note {
  color: rgba(255, 255, 255, 0.7);
}

.work-tracker-note-entry {
  width: 200px;
  padding: 2px 6px;
}
```

**Step 7: Commit**

```bash
git add packages/gnome-extension/extension.js packages/gnome-extension/stylesheet.css
git commit -m "feat: add note icon button and stop icon to GNOME extension panel"
```

---

### Task 7: Manual smoke test checklist

This project has no automated test suite. Verify manually:

1. **Backend:** Start the server with `bun run dev` in `packages/server/`
2. **No active task error:** `curl -X POST http://localhost:3000/api/work-items/active/description -H "Content-Type: application/json" -d '{"description":"test"}' --cookie <session>` → should return 400 "No active work item"
3. **Start a task**, then repeat the curl → should return 200 with updated work item
4. **Append again** → description should have newline-separated entries
5. **Empty description:** Send `{"description":""}` → should return 400 "Description is required"
6. **Dashboard:** Open dashboard, start tracking, verify "Add Note" button appears, expand it, type text, save → note textarea collapses
7. **Dashboard:** Stop tracking → "Add Note" button disappears
8. **Launcher:** Same verification as dashboard
9. **GNOME extension:** Verify ✎ and ■ icons render in panel bar, click ✎ when active → popup appears, save note → popup closes
