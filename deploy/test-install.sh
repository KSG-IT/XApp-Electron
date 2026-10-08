#!/usr/bin/env bash
# Tests install.sh on the CI runner, against a fake GitHub API on localhost.
# It changes the system (/opt, /etc, a test user), so it runs only in CI, as root.
set -euo pipefail

[[ "${CI:-}" == "true" ]] || {
  echo "test-install.sh changes the system. It runs only in CI." >&2
  exit 1
}

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
SERVER_PID=""
cleanup() {
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID"
  rm -rf "$WORK"
}
trap cleanup EXIT

TILL_USER="tilltest"
PORT=8766
API="$WORK/api"
TAG="v2026.1.1"
ASSET="xapp-linux-x64-$TAG.tar.gz"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}
owner_mode() { stat -c '%U:%G %a' "$1"; }

echo "--- a till user with a Desktop folder"
id "$TILL_USER" >/dev/null 2>&1 || useradd -m "$TILL_USER"
HOME_DIR="$(getent passwd "$TILL_USER" | cut -d: -f6)"
runuser -u "$TILL_USER" -- mkdir -p "$HOME_DIR/Desktop"

echo "--- a fake release, owned by uid 1001 like a tarball from CI"
mkdir -p "$WORK/pkg/X-App-linux-x64" "$API/repos/KSG-IT/XApp-Electron/releases" "$API/download"
printf '#!/bin/sh\necho %s\n' "$TAG" >"$WORK/pkg/X-App-linux-x64/X-App"
chmod +x "$WORK/pkg/X-App-linux-x64/X-App"
touch "$WORK/pkg/X-App-linux-x64/chrome-sandbox"
tar -czf "$API/download/$ASSET" -C "$WORK/pkg" --owner=1001 --group=1001 X-App-linux-x64
(cd "$API/download" && sha256sum "$ASSET" >"$ASSET.sha256")
cat >"$API/repos/KSG-IT/XApp-Electron/releases/latest" <<EOF
{"tag_name": "$TAG", "assets": [
  {"name": "$ASSET", "browser_download_url": "http://127.0.0.1:$PORT/download/$ASSET"},
  {"name": "$ASSET.sha256", "browser_download_url": "http://127.0.0.1:$PORT/download/$ASSET.sha256"}
]}
EOF
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$API" >/dev/null 2>&1 &
SERVER_PID=$!
for _ in $(seq 50); do curl -fs "http://127.0.0.1:$PORT/" >/dev/null && break || sleep 0.1; done

# install.sh keeps an existing update.env. Point xapp-update.sh at the fake API.
mkdir -p /etc/xapp
printf 'XAPP_USER=%s\nXAPP_API_BASE=http://127.0.0.1:%s\n' "$TILL_USER" "$PORT" >/etc/xapp/update.env

# Like the piped install: the source is in a folder that only root can open.
SRC="$WORK/src"
mkdir -p "$SRC/assets/icons/png"
chmod 700 "$WORK" "$SRC"
cp -r "$REPO_ROOT/deploy" "$SRC/"
cp "$REPO_ROOT/assets/icons/png/256x256.png" "$SRC/assets/icons/png/"

echo "--- install.sh"
bash "$SRC/deploy/install.sh" "$TILL_USER"

echo "--- check what install.sh made"
[[ "$(owner_mode /opt/xapp/bin/xapp-update.sh)" == "root:root 755" ]] || fail "xapp-update.sh"
[[ "$(owner_mode /etc/sudoers.d/xapp)" == "root:root 440" ]] || fail "sudoers rule mode"
visudo -cqf /etc/sudoers.d/xapp || fail "sudoers rule is not valid"
grep -qx "$TILL_USER ALL=(root) NOPASSWD: /opt/xapp/bin/xapp-update.sh update" /etc/sudoers.d/xapp || fail "sudoers rule content"
grep -q "^XAPP_API_BASE=" /etc/xapp/update.env || fail "install.sh replaced update.env"
systemctl is-enabled xapp-update.timer >/dev/null || fail "timer not enabled"
[[ "$(owner_mode /etc/systemd/user/xapp.service)" == "root:root 644" ]] || fail "xapp.service"
[[ "$(readlink "$HOME_DIR/.config/systemd/user/graphical-session.target.wants/xapp.service")" == /etc/systemd/user/xapp.service ]] || fail "xapp.service not enabled for $TILL_USER"
[[ "$(owner_mode /opt/xapp/xapp.png)" == "root:root 644" ]] || fail "icon"
[[ "$(owner_mode /usr/share/applications/xapp.desktop)" == "root:root 644" ]] || fail "app menu launcher"
[[ "$(owner_mode "$HOME_DIR/Desktop/Krysseprogram.desktop")" == "$TILL_USER:$TILL_USER 755" ]] || fail "Desktop launcher"
[[ "$(basename "$(readlink /opt/xapp/current)")" == "$TAG" ]] || fail "release not active"
[[ -z "$(find /opt/xapp/releases/ ! -user root -o ! -group root)" ]] || fail "release not owned by root"
[[ "$(owner_mode /opt/xapp/current/chrome-sandbox)" == "root:root 4755" ]] || fail "chrome-sandbox"
runuser -u "$TILL_USER" -- test -x /opt/xapp/current/X-App || fail "$TILL_USER cannot run the app"

echo "--- a second run keeps update.env and works again"
bash "$SRC/deploy/install.sh" "$TILL_USER" >/dev/null
grep -q "^XAPP_API_BASE=" /etc/xapp/update.env || fail "second run replaced update.env"

echo "PASS"
