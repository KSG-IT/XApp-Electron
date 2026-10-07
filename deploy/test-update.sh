#!/usr/bin/env bash
# Tests xapp-update.sh against a fake GitHub API on localhost. CI runs it with sudo on Ubuntu.
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/xapp-update.sh"
WORK="$(mktemp -d)"
SERVER_PID=""
cleanup() {
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID"
  rm -rf "$WORK"
}
trap cleanup EXIT

API="$WORK/api"
PORT=8765
export XAPP_CONFIG="$WORK/no-config"
export XAPP_ROOT="$WORK/root"
export XAPP_API_BASE="http://127.0.0.1:$PORT"
export XAPP_REPO="KSG-IT/XApp-Electron"
export XAPP_KEEP=2
mkdir -p "$API/repos/$XAPP_REPO/releases" "$API/download"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}
active() { basename "$(readlink "$XAPP_ROOT/current")"; }

# Makes a release with a fake X-App. Pass "bad" as $2 for a wrong checksum.
make_release() {
  local tag="$1" asset="xapp-linux-x64-$1.tar.gz" pkg="$WORK/pkg/$1"
  mkdir -p "$pkg/X-App-linux-x64"
  printf '#!/bin/sh\necho %s\n' "$tag" >"$pkg/X-App-linux-x64/X-App"
  chmod +x "$pkg/X-App-linux-x64/X-App"
  touch "$pkg/X-App-linux-x64/chrome-sandbox"
  tar -czf "$API/download/$asset" -C "$pkg" X-App-linux-x64
  (cd "$API/download" && sha256sum "$asset" >"$asset.sha256")
  if [[ "${2:-}" == "bad" ]]; then
    echo "0000000000000000000000000000000000000000000000000000000000000000  $asset" >"$API/download/$asset.sha256"
  fi
}

publish_latest() {
  local tag="$1" asset="xapp-linux-x64-$1.tar.gz"
  cat >"$API/repos/$XAPP_REPO/releases/latest" <<EOF
{"tag_name": "$tag", "assets": [
  {"name": "$asset", "browser_download_url": "$XAPP_API_BASE/download/$asset"},
  {"name": "$asset.sha256", "browser_download_url": "$XAPP_API_BASE/download/$asset.sha256"}
]}
EOF
}

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$API" >/dev/null 2>&1 &
SERVER_PID=$!
for _ in $(seq 50); do curl -fs "$XAPP_API_BASE/" >/dev/null && break || sleep 0.1; done

echo "--- first install"
make_release v1.0.0
publish_latest v1.0.0
"$SCRIPT" update
[[ "$(active)" == v1.0.0 ]] || fail "v1.0.0 is not active"
[[ "$(stat -c '%U %a' "$XAPP_ROOT/current/chrome-sandbox")" == "root 4755" ]] || fail "chrome-sandbox is not root 4755"

echo "--- same release again does nothing"
"$SCRIPT" update | grep "is the latest release" >/dev/null || fail "reinstalled v1.0.0"

echo "--- new release"
make_release v1.1.0
publish_latest v1.1.0
"$SCRIPT" update
[[ "$(active)" == v1.1.0 ]] || fail "v1.1.0 is not active"

echo "--- rollback skips the bad release"
"$SCRIPT" rollback
[[ "$(active)" == v1.0.0 ]] || fail "rollback did not activate v1.0.0"
"$SCRIPT" update | grep "skipping v1.1.0" >/dev/null || fail "update reinstalled the rolled-back release"
[[ "$(active)" == v1.0.0 ]] || fail "v1.0.0 is not active after skip"

echo "--- a newer release clears the skip"
make_release v1.2.0
publish_latest v1.2.0
"$SCRIPT" update
[[ "$(active)" == v1.2.0 ]] || fail "v1.2.0 is not active"
[[ ! -f "$XAPP_ROOT/skip-tag" ]] || fail "skip-tag is still there"
[[ "$(ls "$XAPP_ROOT/releases" | sort -V | tr '\n' ' ')" == "v1.1.0 v1.2.0 " ]] || fail "prune kept the wrong releases"

echo "--- wrong checksum changes nothing"
make_release v1.3.0 bad
publish_latest v1.3.0
if "$SCRIPT" update; then fail "update accepted a wrong checksum"; fi
[[ "$(active)" == v1.2.0 ]] || fail "wrong checksum changed the active release"
[[ ! -e "$XAPP_ROOT/releases/v1.3.0" ]] || fail "wrong checksum left a release"

echo "PASS"
