import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import GLib from "gi://GLib";
import Soup from "gi://Soup?version=3.0";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class WorkTrackerPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: "Work Tracker",
      icon_name: "preferences-system-symbolic",
    });
    window.add(page);

    // Connection settings group
    const connectionGroup = new Adw.PreferencesGroup({
      title: "Connection",
      description: "Server connection settings",
    });
    page.add(connectionGroup);

    // Server URL
    const urlRow = new Adw.EntryRow({
      title: "Server URL",
      text: settings.get_string("server-url"),
    });
    urlRow.connect("changed", () => {
      settings.set_string("server-url", urlRow.get_text().replace(/\/+$/, ""));
    });
    connectionGroup.add(urlRow);

    // API Token
    const tokenRow = new Adw.PasswordEntryRow({
      title: "API Token",
      text: settings.get_string("api-token"),
    });
    connectionGroup.add(tokenRow);

    // Save & Connect button
    const saveButtonRow = new Adw.ActionRow({
      title: "Save & Connect",
      subtitle: "Save credentials and fetch project configuration",
      activatable: true,
    });
    saveButtonRow.add_suffix(
      new Gtk.Image({ icon_name: "emblem-synchronizing-symbolic" })
    );
    saveButtonRow.connect("activated", () => {
      const url = urlRow.get_text().replace(/\/+$/, "");
      const token = tokenRow.get_text().trim();

      if (url) settings.set_string("server-url", url);
      if (token) settings.set_string("api-token", token);

      if (url && token) {
        this._fetchConfig(settings, saveButtonRow);
      }
    });
    connectionGroup.add(saveButtonRow);

    // Clear credentials button
    const clearRow = new Adw.ActionRow({
      title: "Clear Credentials",
      subtitle: "Remove stored server URL and API token",
      activatable: true,
    });
    clearRow.add_suffix(
      new Gtk.Image({ icon_name: "edit-delete-symbolic" })
    );
    clearRow.connect("activated", () => {
      settings.set_string("server-url", "");
      settings.set_string("api-token", "");
      urlRow.set_text("");
      tokenRow.set_text("");
    });
    connectionGroup.add(clearRow);

    // Appearance group
    const appearanceGroup = new Adw.PreferencesGroup({
      title: "Appearance",
      description: "Customize the panel layout",
    });
    page.add(appearanceGroup);

    // Button position
    const positionModel = new Gtk.StringList();
    positionModel.append("Left");
    positionModel.append("Center");
    positionModel.append("Right");

    const positionRow = new Adw.ComboRow({
      title: "Button Position",
      subtitle: "Where project buttons appear in the top panel",
      model: positionModel,
    });

    // Set initial selection from settings
    const currentPosition = settings.get_string("button-position");
    const positionMap = { left: 0, center: 1, right: 2 };
    positionRow.set_selected(positionMap[currentPosition] ?? 0);

    positionRow.connect("notify::selected", () => {
      const values = ["left", "center", "right"];
      settings.set_string("button-position", values[positionRow.get_selected()]);
    });
    appearanceGroup.add(positionRow);
  }

  _fetchConfig(settings, row) {
    const serverUrl = settings.get_string("server-url");
    const apiToken = settings.get_string("api-token");
    const url = `${serverUrl}/api/dashboard/${apiToken}`;

    const session = new Soup.Session();
    const message = Soup.Message.new("GET", url);
    if (!message) {
      row.set_subtitle("Invalid URL");
      return;
    }

    row.set_subtitle("Fetching...");

    session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null,
      (sess, result) => {
        try {
          const bytes = sess.send_and_read_finish(result);
          const statusCode = message.get_status();
          if (statusCode !== Soup.Status.OK) {
            row.set_subtitle(`Error: HTTP ${statusCode}`);
            return;
          }
          const body = new TextDecoder().decode(bytes.get_data());
          const data = JSON.parse(body);

          const slugs = ["", "", "", "", "", ""];
          const labels = ["", "", "", "", "", ""];

          for (const item of data) {
            const i = item.slot - 1;
            slugs[i] = item.projectSlug ?? "";
            labels[i] = item.projectName ?? "";
          }

          settings.set_strv("slot-slugs", slugs);
          settings.set_strv("slot-labels", labels);
          row.set_subtitle(`Connected — ${data.length} project(s) loaded`);
        } catch (e) {
          row.set_subtitle(`Error: ${e.message}`);
        }
      }
    );
  }
}
