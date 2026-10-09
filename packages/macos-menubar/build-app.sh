#!/bin/bash
# Builds WorkTracker.app into ./build/.
# Usage: ./build-app.sh [--install]
#   --install   copy the app to /Applications (quits a running copy first)
#   UNIVERSAL=1 ./build-app.sh   build for Apple Silicon + Intel (requires full Xcode)
set -euo pipefail
cd "$(dirname "$0")"

ARCH_FLAGS=()
if [[ "${UNIVERSAL:-0}" == "1" ]]; then
  ARCH_FLAGS=(--arch arm64 --arch x86_64)
fi

swift build -c release ${ARCH_FLAGS[@]+"${ARCH_FLAGS[@]}"}
BIN_DIR="$(swift build -c release ${ARCH_FLAGS[@]+"${ARCH_FLAGS[@]}"} --show-bin-path)"

APP="build/WorkTracker.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp "$BIN_DIR/WorkTracker" "$APP/Contents/MacOS/WorkTracker"
cp Info.plist "$APP/Contents/Info.plist"

# Ad-hoc signature so the app runs locally (use a Developer ID to distribute).
codesign --force --sign - "$APP"
echo "Built $APP"

if [[ "${1:-}" == "--install" ]]; then
  osascript -e 'quit app "WorkTracker"' 2>/dev/null || true
  rm -rf "/Applications/WorkTracker.app"
  cp -R "$APP" /Applications/
  echo "Installed to /Applications/WorkTracker.app — open it from Launchpad or Spotlight."
fi
