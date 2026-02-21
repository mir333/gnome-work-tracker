import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Soup from "gi://Soup";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

const _session = new Soup.Session();

function httpGet(url, callback) {
  const message = Soup.Message.new("GET", url);
  if (!message) {
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
        if (statusCode !== Soup.Status.OK) {
          callback(new Error(`HTTP ${statusCode}`), null);
          return;
        }
        const body = new TextDecoder().decode(bytes.get_data());
        callback(null, JSON.parse(body));
      } catch (e) {
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
      this._buildButtons();
      this._restoreActiveState();
    }

    _buildButtons() {
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

      const stopBtn = new St.Button({
        label: "Stop",
        style_class: "work-tracker-button work-tracker-stop panel-button",
        can_focus: true,
        track_hover: true,
      });
      stopBtn.connect("clicked", () => this._onStopClicked());
      this.add_child(stopBtn);
    }

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

    // Auto-fetch project data on startup if credentials exist
    const token = this._settings.get_string("api-token");
    const url = this._settings.get_string("server-url");
    if (token && url) {
      this.fetchAndStoreConfig();
    }
  }

  disable() {
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
