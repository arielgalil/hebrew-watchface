#!/bin/bash
# Pushes the watch face to the phone's "open with" picker in one command (the watch itself has no adb;
# the Zepp / AmazFaces app on the phone does the last step, over Bluetooth).
# Usage:  bash tools/sync.sh            open the current package
#         bash tools/sync.sh --build    rebuild first
#         bash tools/sync.sh --dry      only copy, do not open anything
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIP="$ROOT/new_face/hebrew_date_face_v3.zip"
OUT=/storage/emulated/0/Download/Hebrew_Date.zip   # short ASCII name: easy to find in any picker
[ "$1" = "--build" ] && (cd "$ROOT" && python3 -I tools/build_v3.py | tail -1)
cp "$ZIP" "$OUT"
echo "copied: $OUT ($(stat -c %s "$OUT") bytes)"
[ "$1" = "--dry" ] && exit 0
termux-open --chooser --content-type application/zip "$OUT"
