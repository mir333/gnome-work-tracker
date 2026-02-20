import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Soup from "gi://Soup";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

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

// Settings indicator (gear icon with popup for login/config)
const SettingsIndicator = GObject.registerClass(
  class SettingsIndicator extends PanelMenu.Button {
    _init(extension) {
      super._init(0.0, "Work Tracker Settings");
      this._extension = extension;
      this._settings = extension.getSettings();

      this.add_child(
        new St.Icon({
          icon_name: "preferences-system-symbolic",
          style_class: "system-status-icon",
        })
      );

      this._buildMenu();
    }

    _buildMenu() {
      const menu = this.menu;
      menu.removeAll();

      const apiToken = this._settings.get_string("api-token");

      if (!apiToken) {
        // Server URL entry
        const urlItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        const urlBox = new St.BoxLayout({ vertical: true, style: "padding: 4px 0;" });
        urlBox.add_child(new St.Label({ text: "Server URL:", style: "font-size: 11px; margin-bottom: 2px;" }));
        const urlEntry = new St.Entry({
          hint_text: "http://localhost:3000",
          text: this._settings.get_string("server-url"),
          can_focus: true,
          style: "width: 220px;",
        });
        urlBox.add_child(urlEntry);
        urlItem.add_child(urlBox);
        menu.addMenuItem(urlItem);

        // API Token entry
        const tokenItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        const tokenBox = new St.BoxLayout({ vertical: true, style: "padding: 4px 0;" });
        tokenBox.add_child(new St.Label({ text: "API Token:", style: "font-size: 11px; margin-bottom: 2px;" }));
        const tokenEntry = new St.Entry({
          hint_text: "Paste token here",
          can_focus: true,
          style: "width: 220px;",
        });
        tokenBox.add_child(tokenEntry);
        tokenItem.add_child(tokenBox);
        menu.addMenuItem(tokenItem);

        // Save button
        const saveItem = new PopupMenu.PopupMenuItem("Save & Connect");
        saveItem.connect("activate", () => {
          const newUrl = urlEntry.get_text().replace(/\/+$/, "");
          const newToken = tokenEntry.get_text().trim();
          if (newUrl) this._settings.set_string("server-url", newUrl);
          if (newToken) this._settings.set_string("api-token", newToken);
          if (newUrl && newToken) {
            this._extension.fetchAndStoreConfig();
          }
          this._buildMenu();
        });
        menu.addMenuItem(saveItem);
      } else {
        const refreshItem = new PopupMenu.PopupMenuItem("Refresh Config");
        refreshItem.connect("activate", () => {
          this._extension.fetchAndStoreConfig();
        });
        menu.addMenuItem(refreshItem);

        const logoutItem = new PopupMenu.PopupMenuItem("Clear credentials");
        logoutItem.connect("activate", () => {
          this._settings.set_string("api-token", "");
          this._settings.set_string("server-url", "");
          this._extension._bar?.refreshFromSettings();
          this._buildMenu();
        });
        menu.addMenuItem(logoutItem);
      }
    }
  }
);

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

// Main extension
export default class WorkTrackerExtension extends Extension {
  enable() {
    this._settings = this.getSettings();

    this._bar = new WorkTrackerBar(this);
    Main.panel._leftBox.insert_child_at_index(this._bar, 0);

    this._settingsIndicator = new SettingsIndicator(this);
    Main.panel.addToStatusArea(this.metadata.uuid, this._settingsIndicator);

    this._settingsChangedId = this._settings.connect("changed", () => {
      this._bar.refreshFromSettings();
    });
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

    if (this._settingsIndicator) {
      this._settingsIndicator.destroy();
      this._settingsIndicator = null;
    }

    this._settings = null;
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
