#!/bin/bash
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/work-tracker@gnome-work-tracker"
mkdir -p "$EXT_DIR/schemas"
cp metadata.json extension.js stylesheet.css "$EXT_DIR/"
cp schemas/*.gschema.xml "$EXT_DIR/schemas/"
glib-compile-schemas "$EXT_DIR/schemas/"
echo "Installed. Restart GNOME Shell (Alt+F2 → r) or log out/in to load."
