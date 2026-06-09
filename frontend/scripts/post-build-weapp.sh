#!/bin/bash
# Post-build hook for weapp: append keyframes to app.wxss
# Taro's cssnano strips @keyframes, so we inject them after build

KEYFRAMES_FILE="src/keyframes.wxss"
DIST_WXSS="dist/app.wxss"

if [ -f "$KEYFRAMES_FILE" ] && [ -f "$DIST_WXSS" ]; then
  cat "$KEYFRAMES_FILE" >> "$DIST_WXSS"
  echo "✅ Keyframes appended to app.wxss"
else
  echo "⚠️  keyframes.wxss or app.wxss not found"
fi
