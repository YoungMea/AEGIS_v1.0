#!/usr/bin/env bash
# Runs once when the .deb package is installed. The Chromium sandbox helper
# must be owned by root with the setuid bit (mode 4755) for Electron to
# start without --no-sandbox. dpkg copies the file as root but doesn't set
# the right permission bits on its own.
set -e

SANDBOX_PATH=/opt/AEGIS/chrome-sandbox
if [ -e "$SANDBOX_PATH" ]; then
  chown root:root "$SANDBOX_PATH" || true
  chmod 4755 "$SANDBOX_PATH" || true
fi

exit 0
