# Edit Start Time Popup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dropdown popup to the GNOME extension that appears when clicking an active project button, allowing the user to edit the work item's start time (HH:MM).

**Architecture:** Two changes: (1) a new token-based PUT endpoint on the backend for updating work items, and (2) a reworked GNOME extension that shows a native PopupMenu dropdown on active button click with an HH:MM entry and Save button. The trigger API already returns the work item — we store it and use its `id` and `startedAt` for the popup.

**Tech Stack:** TypeScript/Hono/Prisma (backend), GJS/GNOME Shell APIs (extension)

---

### Task 1: Add token-based work item update endpoint (backend test)

**Files:**
- Modify: `packages/server/src/services/trigger.service.test.ts`

**Step 1: Write the failing test**

Add a new `describe` block to the existing test file for `triggerService.updateWorkItem`:

```typescript
describe("triggerService.updateWorkItem", () => {
  test("updates startedAt for a work item owned by the user", async () => {
    const workItem = {
      id: "wi-1",
      projectId: PROJECT_ID,
      userId: USER_ID,
      startedAt: new Date("2026-03-05T10:00:00"),
      endedAt: null,
    };

    mockFindById.mockResolvedValue(workItem);
    mockUpdate.mockResolvedValue({
      ...workItem,
      startedAt: new Date("2026-03-05T09:30:00"),
    });

    const result = await triggerService.updateWorkItem(USER_ID, "wi-1", {
      startedAt: "2026-03-05T09:30:00",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result!.startedAt).toEqual(new Date("2026-03-05T09:30:00"));
  });

  test("returns null when work item does not belong to user", async () => {
    mockFindById.mockResolvedValue({
      id: "wi-1",
      projectId: PROJECT_ID,
      userId: "other-user",
      startedAt: new Date(),
      endedAt: null,
    });

    const result = await triggerService.updateWorkItem(USER_ID, "wi-1", {
      startedAt: "2026-03-05T09:30:00",
    });

    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("returns null when work item not found", async () => {
    mockFindById.mockResolvedValue(null);

    const result = await triggerService.updateWorkItem(USER_ID, "nonexistent", {
      startedAt: "2026-03-05T09:30:00",
    });

    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
```

You'll also need to add a `mockFindById` mock at the top of the file alongside the existing mocks:

```typescript
const mockFindById = mock(() => Promise.resolve(null));
```

And add it to the `mock.module` for work-item.repository:

```typescript
mock.module("../repositories/work-item.repository", () => ({
  workItemRepository: {
    findActiveByUser: mockFindActiveByUser,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
    findById: mockFindById,
  },
}));
```

And add `mockFindById.mockReset()` to the `beforeEach` block.

**Step 2: Run test to verify it fails**

Run: `cd /workspace/miro/gnome-work-tracker/packages/server && PATH="$HOME/.bun/bin:$PATH" bun test src/services/trigger.service.test.ts`

Expected: FAIL — `triggerService.updateWorkItem is not a function`

**Step 3: Commit**

```bash
git add packages/server/src/services/trigger.service.test.ts
git commit -m "test: add tests for token-based work item update"
```

---

### Task 2: Implement updateWorkItem in trigger service + findById in repository

**Files:**
- Modify: `packages/server/src/services/trigger.service.ts`
- Modify: `packages/server/src/repositories/work-item.repository.ts`

**Step 1: Add `findById` to the work-item repository**

Add this method to `workItemRepository` in `packages/server/src/repositories/work-item.repository.ts`:

```typescript
  async findById(id: string) {
    return prisma.workItem.findUnique({ where: { id } });
  },
```

**Step 2: Add `updateWorkItem` to the trigger service**

Add this method to `triggerService` in `packages/server/src/services/trigger.service.ts`:

```typescript
  async updateWorkItem(
    userId: string,
    workItemId: string,
    data: { startedAt?: string }
  ) {
    const workItem = await workItemRepository.findById(workItemId);
    if (!workItem || workItem.userId !== userId) return null;

    return workItemRepository.update(workItemId, {
      ...(data.startedAt ? { startedAt: new Date(data.startedAt) } : {}),
    });
  },
```

**Step 3: Run tests to verify they pass**

Run: `cd /workspace/miro/gnome-work-tracker/packages/server && PATH="$HOME/.bun/bin:$PATH" bun test src/services/trigger.service.test.ts`

Expected: All 7 tests PASS (4 existing + 3 new).

**Step 4: Commit**

```bash
git add packages/server/src/services/trigger.service.ts packages/server/src/repositories/work-item.repository.ts
git commit -m "feat: add updateWorkItem to trigger service with ownership check"
```

---

### Task 3: Add token-based PUT route

**Files:**
- Modify: `packages/server/src/routes/trigger.ts`

**Step 1: Add the PUT endpoint**

Add this route to `trigger.ts`, after the existing token-based GET routes (before the `export`):

```typescript
// Token-based work item update (for GNOME extension)
trigger.put("/:apiToken/work-items/:id", async (c) => {
  const profile = await triggerService.resolveToken(c.req.param("apiToken"));
  if (!profile) return c.json({ error: "Invalid token" }, 401);

  const data = await c.req.json();
  const workItem = await triggerService.updateWorkItem(
    profile.userId,
    c.req.param("id"),
    data
  );
  if (!workItem) return c.json({ error: "Work item not found" }, 404);
  return c.json({ ok: true, workItem });
});
```

**Step 2: Run existing tests to make sure nothing broke**

Run: `cd /workspace/miro/gnome-work-tracker/packages/server && PATH="$HOME/.bun/bin:$PATH" bun test src/services/trigger.service.test.ts`

Expected: All 7 tests PASS.

**Step 3: Commit**

```bash
git add packages/server/src/routes/trigger.ts
git commit -m "feat: add token-based PUT endpoint for work item update"
```

---

### Task 4: Store work item data from trigger response

**Files:**
- Modify: `packages/gnome-extension/extension.js`

Currently `_onProjectClicked` ignores the response body. We need to store the returned `workItem` (specifically `id` and `startedAt`) so the popup can use them.

**Step 1: Update `_onProjectClicked` to store work item data**

In `WorkTrackerBar._onProjectClicked`, change the callback to capture the response data:

Replace:
```javascript
    _onProjectClicked(slotIndex, slug) {
      const apiToken = this._settings.get_string("api-token");
      const serverUrl = this._settings.get_string("server-url");
      const url = `${serverUrl}/api/trigger/${apiToken}/${slug}`;

      httpGet(url, (err) => {
        if (err) {
          console.error(`[work-tracker] Trigger failed: ${err.message}`);
          return;
        }
        this._setActiveSlot(slotIndex);
        this._settings.set_int("active-slot", slotIndex);
      });
    }
```

With:
```javascript
    _onProjectClicked(slotIndex, slug) {
      // If this slot is already active, show the edit popup
      const currentActive = this._settings.get_int("active-slot");
      if (currentActive === slotIndex && this._activeWorkItem) {
        this._showEditPopup(slotIndex);
        return;
      }

      const apiToken = this._settings.get_string("api-token");
      const serverUrl = this._settings.get_string("server-url");
      const url = `${serverUrl}/api/trigger/${apiToken}/${slug}`;

      httpGet(url, (err, data) => {
        if (err) {
          console.error(`[work-tracker] Trigger failed: ${err.message}`);
          return;
        }
        this._activeWorkItem = data?.workItem ?? null;
        this._setActiveSlot(slotIndex);
        this._settings.set_int("active-slot", slotIndex);
      });
    }
```

**Step 2: Clear work item data on stop**

In `_onStopClicked`, add `this._activeWorkItem = null;` after the success callback:

Replace:
```javascript
    _onStopClicked() {
      const apiToken = this._settings.get_string("api-token");
      const serverUrl = this._settings.get_string("server-url");
      const url = `${serverUrl}/api/trigger/${apiToken}/stop`;

      httpGet(url, (err) => {
        if (err) {
          console.error(`[work-tracker] Stop failed: ${err.message}`);
          return;
        }
        this._setActiveSlot(-1);
        this._settings.set_int("active-slot", -1);
      });
    }
```

With:
```javascript
    _onStopClicked() {
      const apiToken = this._settings.get_string("api-token");
      const serverUrl = this._settings.get_string("server-url");
      const url = `${serverUrl}/api/trigger/${apiToken}/stop`;

      httpGet(url, (err) => {
        if (err) {
          console.error(`[work-tracker] Stop failed: ${err.message}`);
          return;
        }
        this._activeWorkItem = null;
        this._setActiveSlot(-1);
        this._settings.set_int("active-slot", -1);
      });
    }
```

**Step 3: Initialize `_activeWorkItem` in `_init`**

In `WorkTrackerBar._init`, add after `this._buttons = [];`:

```javascript
      this._activeWorkItem = null;
```

**Step 4: Commit**

```bash
git add packages/gnome-extension/extension.js
git commit -m "feat: store work item data from trigger response"
```

---

### Task 5: Add httpPut helper function

**Files:**
- Modify: `packages/gnome-extension/extension.js`

**Step 1: Add `httpPut` function after the existing `httpGet`**

```javascript
function httpPut(url, body, callback) {
  console.log(`[work-tracker] PUT ${url}`);
  const message = Soup.Message.new("PUT", url);
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

**Step 2: Commit**

```bash
git add packages/gnome-extension/extension.js
git commit -m "feat: add httpPut helper for GNOME extension"
```

---

### Task 6: Add the edit popup with PopupMenu

**Files:**
- Modify: `packages/gnome-extension/extension.js`
- Modify: `packages/gnome-extension/stylesheet.css`

**Step 1: Add PopupMenu import**

At the top of `extension.js`, add after the existing imports:

```javascript
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
```

**Step 2: Add `_showEditPopup` method to `WorkTrackerBar`**

Add this method to the `WorkTrackerBar` class (after `_onStopClicked`):

```javascript
    _showEditPopup(slotIndex) {
      // Close any existing popup
      if (this._editPopup) {
        this._editPopup.close();
        this._editPopup.destroy();
        this._editPopup = null;
      }

      // Find the button for this slot
      const entry = this._buttons.find((b) => b.index === slotIndex);
      if (!entry) return;

      // Format current start time as HH:MM
      const startedAt = new Date(this._activeWorkItem.startedAt);
      const hh = String(startedAt.getHours()).padStart(2, "0");
      const mm = String(startedAt.getMinutes()).padStart(2, "0");

      // Create popup menu anchored to the button
      const popup = new PopupMenu.PopupMenu(entry.button, 0.0, St.Side.TOP);
      Main.uiGroup.add_child(popup.actor);
      popup.actor.add_style_class_name("work-tracker-popup");

      // Create a custom menu item with our edit UI
      const item = new PopupMenu.PopupBaseMenuItem({ reactive: false });

      const box = new St.BoxLayout({
        vertical: false,
        style_class: "work-tracker-edit-box",
      });

      const label = new St.Label({
        text: "Started at:",
        y_align: Clutter.ActorAlign.CENTER,
        style_class: "work-tracker-edit-label",
      });
      box.add_child(label);

      const timeEntry = new St.Entry({
        text: `${hh}:${mm}`,
        style_class: "work-tracker-edit-entry",
        can_focus: true,
      });
      box.add_child(timeEntry);

      const saveBtn = new St.Button({
        label: "Save",
        style_class: "work-tracker-edit-save",
        can_focus: true,
      });
      saveBtn.connect("clicked", () => {
        this._saveStartTime(timeEntry.get_text(), popup);
      });
      box.add_child(saveBtn);

      item.add_child(box);
      popup.addMenuItem(item);

      // Open the popup
      popup.open();

      // Focus the entry after opening
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        timeEntry.grab_key_focus();
        return GLib.SOURCE_REMOVE;
      });

      this._editPopup = popup;
    }
```

**Step 3: Add `_saveStartTime` method to `WorkTrackerBar`**

Add this method after `_showEditPopup`:

```javascript
    _saveStartTime(timeStr, popup) {
      // Validate HH:MM format
      const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) {
        console.error(`[work-tracker] Invalid time format: ${timeStr}`);
        return;
      }

      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.error(`[work-tracker] Invalid time: ${timeStr}`);
        return;
      }

      // Build ISO datetime using today's date
      const now = new Date();
      const newStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hours,
        minutes,
        0
      );

      const apiToken = this._settings.get_string("api-token");
      const serverUrl = this._settings.get_string("server-url");
      const workItemId = this._activeWorkItem.id;
      const url = `${serverUrl}/api/trigger/${apiToken}/work-items/${workItemId}`;

      httpPut(url, { startedAt: newStart.toISOString() }, (err, data) => {
        if (err) {
          console.error(`[work-tracker] Update failed: ${err.message}`);
          return;
        }
        this._activeWorkItem = data?.workItem ?? this._activeWorkItem;
        popup.close();
        popup.destroy();
        this._editPopup = null;
      });
    }
```

**Step 4: Clean up popup on destroy**

In `WorkTrackerBar._init`, add after `this._activeWorkItem = null;`:

```javascript
      this._editPopup = null;
```

Also add cleanup in `_buildButtons` (at the very top of the method, before `this.destroy_all_children()`):

```javascript
      if (this._editPopup) {
        this._editPopup.close();
        this._editPopup.destroy();
        this._editPopup = null;
      }
```

**Step 5: Add CSS styles**

Append to `packages/gnome-extension/stylesheet.css`:

```css

.work-tracker-popup {
  margin-top: 4px;
}

.work-tracker-edit-box {
  spacing: 8px;
  padding: 4px 8px;
}

.work-tracker-edit-label {
  color: #ccc;
}

.work-tracker-edit-entry {
  width: 60px;
  padding: 2px 6px;
}

.work-tracker-edit-save {
  padding: 2px 12px;
  border-radius: 4px;
  background-color: rgba(53, 132, 228, 0.8);
  color: white;
  font-weight: bold;
}

.work-tracker-edit-save:hover {
  background-color: rgba(53, 132, 228, 1.0);
}
```

**Step 6: Commit**

```bash
git add packages/gnome-extension/extension.js packages/gnome-extension/stylesheet.css
git commit -m "feat: add edit start time popup on active project click"
```

---

### Task 7: Run all backend tests

**Step 1: Run all tests**

Run: `cd /workspace/miro/gnome-work-tracker/packages/server && PATH="$HOME/.bun/bin:$PATH" bun test`

Expected: All tests PASS.

**Step 2: Commit if any fixes needed**
