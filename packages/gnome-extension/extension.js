import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Soup from "gi://Soup";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as LoginManager from "resource:///org/gnome/shell/misc/loginManager.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

const _session = new Soup.Session();

function httpGet(url, callback) {
  console.log(`[work-tracker] GET ${url}`);
  const message = Soup.Message.new("GET", url);
  if (!message) {
    console.error(`[work-tracker] Invalid URL: ${url}`);
    callback(new Error(`Invalid URL: ${url}`), null);
    return;
  }
  _session.send_and_read_async(
    message,
    GLib.PRIORITY_DEFAULT,
    null,
    (session, result) => {
      try {
        const bytes = session.send_and_read_finish(result);
        const statusCode = message.get_status();
        const body = new TextDecoder().decode(bytes.get_data());
        console.log(`[work-tracker] Response ${statusCode}: ${body}`);
        if (statusCode !== Soup.Status.OK) {
          callback(new Error(`HTTP ${statusCode}: ${body}`), null);
          return;
        }
        callback(null, JSON.parse(body));
      } catch (e) {
        console.error(`[work-tracker] Request error: ${e.message}`);
        callback(e, null);
      }
    }
  );
}

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

// Project button
const ProjectButton = GObject.registerClass(
  class ProjectButton extends St.Button {
    _init(label, slug) {
      super._init({
        label,
        style_class: "work-tracker-button panel-button",
        can_focus: true,
        track_hover: true,
      });
      this._slug = slug;
    }

    get slug() {
      return this._slug;
    }

    setActive(active) {
      if (active) this.add_style_class_name("work-tracker-active");
      else this.remove_style_class_name("work-tracker-active");
    }
  }
);

// Button bar
const WorkTrackerBar = GObject.registerClass(
  class WorkTrackerBar extends St.BoxLayout {
    _init(extension) {
      super._init({ style_class: "work-tracker-bar" });
      this._extension = extension;
      this._settings = extension.getSettings();
      this._buttons = [];
      this._activeWorkItem = null;
      this._editPopup = null;
      this._buildButtons();
      this._restoreActiveState();
    }

    _buildButtons() {
      if (this._editPopup) {
        this._editPopup.close();
        this._editPopup.destroy();
        this._editPopup = null;
      }
      this.destroy_all_children();
      this._buttons = [];

      const slugs = this._settings.get_strv("slot-slugs");
      const labels = this._settings.get_strv("slot-labels");
      const apiToken = this._settings.get_string("api-token");

      if (!apiToken) return;

      for (let i = 0; i < 6; i++) {
        const slug = slugs[i] ?? "";
        const label = labels[i] ?? "";
        if (!slug) continue;

        const btn = new ProjectButton(label, slug);
        btn.connect("clicked", () => this._onProjectClicked(i, slug));
        this.add_child(btn);
        this._buttons.push({ index: i, slug, button: btn });
      }

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
    }

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

    _onNoteClicked() {
      const currentActive = this._settings.get_int("active-slot");
      if (currentActive < 0 || !this._activeWorkItem) {
        console.log("[work-tracker] No active work item, cannot add note");
        return;
      }
      this._showNotePopup();
    }

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

    _setActiveSlot(slotIndex) {
      for (const { index, button } of this._buttons) {
        button.setActive(index === slotIndex);
      }
    }

    _restoreActiveState() {
      const saved = this._settings.get_int("active-slot");
      this._setActiveSlot(saved);
    }

    refreshFromSettings() {
      this._buildButtons();
      this._restoreActiveState();
    }
  }
);

function _getPanelBox(position) {
  switch (position) {
    case "center":
      return Main.panel._centerBox;
    case "right":
      return Main.panel._rightBox;
    default:
      return Main.panel._leftBox;
  }
}

// Main extension
export default class WorkTrackerExtension extends Extension {
  enable() {
    this._settings = this.getSettings();

    this._bar = new WorkTrackerBar(this);

    // Add bar to the configured panel position
    const position = this._settings.get_string("button-position");
    _getPanelBox(position).insert_child_at_index(this._bar, 0);

    // Listen for settings changes to refresh buttons
    this._settingsChangedId = this._settings.connect("changed", (settings, key) => {
      if (key === "button-position") {
        this._moveBar();
      } else if (key === "api-token") {
        // Auto-fetch config when token is set from prefs
        const token = settings.get_string("api-token");
        const url = settings.get_string("server-url");
        if (token && url) {
          this.fetchAndStoreConfig();
        } else {
          this._bar.refreshFromSettings();
        }
      } else {
        this._bar.refreshFromSettings();
      }
    });

    // Auto-stop on screen lock
    this._screenShieldId = Main.screenShield.connect("active-changed", () => {
      if (Main.screenShield.active && this._settings.get_boolean("auto-stop-on-lock")) {
        console.log("[work-tracker] Screen locked, stopping tracker");
        this._bar?._onStopClicked();
      }
    });

    // Auto-stop on suspend/shutdown
    this._loginManager = LoginManager.getLoginManager();
    this._prepareForSleepId = this._loginManager.connect(
      "prepare-for-sleep",
      (_manager, suspending) => {
        if (suspending && this._settings.get_boolean("auto-stop-on-lock")) {
          console.log("[work-tracker] System suspending, stopping tracker");
          this._bar?._onStopClicked();
        }
      }
    );

    // Auto-fetch project data on startup if credentials exist
    const token = this._settings.get_string("api-token");
    const url = this._settings.get_string("server-url");
    if (token && url) {
      this.fetchAndStoreConfig();
    }
  }

  disable() {
    if (this._screenShieldId) {
      Main.screenShield.disconnect(this._screenShieldId);
      this._screenShieldId = null;
    }

    if (this._prepareForSleepId && this._loginManager) {
      this._loginManager.disconnect(this._prepareForSleepId);
      this._prepareForSleepId = null;
      this._loginManager = null;
    }

    if (this._settingsChangedId) {
      this._settings.disconnect(this._settingsChangedId);
      this._settingsChangedId = null;
    }

    if (this._bar) {
      this._bar.destroy();
      this._bar = null;
    }

    this._settings = null;
  }

  _moveBar() {
    if (!this._bar) return;

    // Remove from current parent
    const parent = this._bar.get_parent();
    if (parent) parent.remove_child(this._bar);

    // Add to new position
    const position = this._settings.get_string("button-position");
    _getPanelBox(position).insert_child_at_index(this._bar, 0);
  }

  fetchAndStoreConfig() {
    const serverUrl = this._settings.get_string("server-url");
    const apiToken = this._settings.get_string("api-token");
    const url = `${serverUrl}/api/dashboard/${apiToken}`;

    httpGet(url, (err, data) => {
      if (err) {
        console.error(`[work-tracker] Config fetch failed: ${err.message}`);
        return;
      }

      const slugs = ["", "", "", "", "", ""];
      const labels = ["", "", "", "", "", ""];

      for (const item of data) {
        const i = item.slot - 1;
        slugs[i] = item.projectSlug ?? "";
        labels[i] = item.projectName ?? "";
      }

      this._settings.set_strv("slot-slugs", slugs);
      this._settings.set_strv("slot-labels", labels);
    });
  }
}
