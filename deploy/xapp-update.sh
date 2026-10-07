#!/usr/bin/env bash
# Installs X-App releases from GitHub on the till. See README.md → "Install and update on the till".
#
#   xapp-update.sh check      print "available <tag>" or "none". Needs no root.
#   xapp-update.sh update     install the latest release if it is new. Does not restart the app.
#   xapp-update.sh rollback   go back to the previous release, skip the current one, restart the app
#   xapp-update.sh status     show the installed releases
#
# The app runs `check` and `update` itself while Soci is closed, and then restarts
# (updater.js). `update` runs through sudo (deploy/sudoers.example). The timer
# runs `update` once a day as a fallback.
#
# Layout under XAPP_ROOT (default /opt/xapp):
#   releases/<tag>/   one unpacked release each
#   current           symlink to the active release
#   skip-tag          a tag that `update` must not install (written by `rollback`)
set -euo pipefail

# The timer and a manual run over SSH use the same config file.
XAPP_CONFIG="${XAPP_CONFIG:-/etc/xapp/update.env}"
if [[ -f "$XAPP_CONFIG" ]]; then
  # shellcheck source=/dev/null
  source "$XAPP_CONFIG"
fi

XAPP_REPO="${XAPP_REPO:-KSG-IT/XApp-Electron}"
XAPP_ROOT="${XAPP_ROOT:-/opt/xapp}"
XAPP_API_BASE="${XAPP_API_BASE:-https://api.github.com}"
# The desktop user that runs xapp.service. `rollback` restarts the app for this user.
XAPP_USER="${XAPP_USER:-}"
XAPP_KEEP="${XAPP_KEEP:-3}"

RELEASES="$XAPP_ROOT/releases"
CURRENT="$XAPP_ROOT/current"
SKIP_TAG_FILE="$XAPP_ROOT/skip-tag"
ASSET_PREFIX="xapp-linux-x64"

TMP_DIR=""
trap 'rm -rf "$TMP_DIR"' EXIT

log() { echo "xapp-update: $*"; }
die() {
  log "error: $*" >&2
  exit 1
}

current_tag() {
  if [[ -L "$CURRENT" ]]; then basename "$(readlink "$CURRENT")"; fi
}

# Prints "<tag> <tarball url> <checksum url>" for the latest release.
# GitHub leaves drafts and pre-releases out of /releases/latest.
latest_release() {
  curl -fsSL --max-time 15 -H "Accept: application/vnd.github+json" \
    "$XAPP_API_BASE/repos/$XAPP_REPO/releases/latest" |
    python3 -c '
import json, sys
release = json.load(sys.stdin)
tag = release["tag_name"]
urls = {a["name"]: a["browser_download_url"] for a in release["assets"]}
asset = f"'"$ASSET_PREFIX"'-{tag}.tar.gz"
print(tag, urls[asset], urls[asset + ".sha256"])
'
}

restart_app() {
  if [[ -z "$XAPP_USER" ]]; then
    log "XAPP_USER is not set. Start the app by hand."
    return
  fi
  if systemctl --user --machine="$XAPP_USER@" restart xapp.service; then
    log "restarted xapp.service for $XAPP_USER"
  else
    log "could not restart xapp.service for $XAPP_USER. Start the app by hand."
  fi
}

# Points `current` at releases/<tag>. The rename is atomic, so `current` is never missing.
activate() {
  ln -sfn "releases/$1" "$XAPP_ROOT/current.new"
  mv -T "$XAPP_ROOT/current.new" "$CURRENT"
  log "active release: $1"
}

# Removes old releases. Keeps the newest XAPP_KEEP and always the active one.
prune() {
  local active
  active="$(current_tag)"
  ls -1 "$RELEASES" | sort -V | head -n "-$XAPP_KEEP" | while read -r tag; do
    if [[ "$tag" != "$active" ]]; then
      rm -rf "${RELEASES:?}/$tag"
      log "removed old release $tag"
    fi
  done
}

install_release() {
  local tag="$1" tarball_url="$2" checksum_url="$3"
  TMP_DIR="$(mktemp -d)"
  local tmp="$TMP_DIR"
  local asset="$ASSET_PREFIX-$tag.tar.gz"

  log "downloading $tag"
  curl -fsSL --connect-timeout 15 --max-time 900 -o "$tmp/$asset" "$tarball_url"
  curl -fsSL --connect-timeout 15 --max-time 60 -o "$tmp/$asset.sha256" "$checksum_url"
  (cd "$tmp" && sha256sum --check --quiet "$asset.sha256") || die "checksum of $asset does not match"

  mkdir -p "$tmp/unpacked"
  tar -xzf "$tmp/$asset" -C "$tmp/unpacked"
  local app_dir="$tmp/unpacked/X-App-linux-x64"
  [[ -x "$app_dir/X-App" ]] || die "$asset has no X-App-linux-x64/X-App"

  # Ubuntu 23.10+ blocks the user namespaces that Chromium's sandbox needs.
  # The SUID helper is the fix (README.md → "Ubuntu sandbox").
  chown root:root "$app_dir/chrome-sandbox"
  chmod 4755 "$app_dir/chrome-sandbox"

  rm -rf "${RELEASES:?}/$tag"
  mv "$app_dir" "$RELEASES/$tag"
}

# True if `update` would install <tag>.
is_new() {
  [[ "$1" != "$(current_tag)" ]] && ! [[ -f "$SKIP_TAG_FILE" && "$(cat "$SKIP_TAG_FILE")" == "$1" ]]
}

cmd_check() {
  local latest _
  read -r latest _ < <(latest_release) || die "could not read the latest release of $XAPP_REPO"
  if is_new "$latest"; then echo "available $latest"; else echo "none"; fi
}

cmd_update() {
  local latest tarball_url checksum_url active
  read -r latest tarball_url checksum_url < <(latest_release) ||
    die "could not read the latest release of $XAPP_REPO"
  active="$(current_tag)"

  if [[ "$latest" == "$active" ]]; then
    log "$active is the latest release"
    return
  fi
  if [[ -f "$SKIP_TAG_FILE" && "$(cat "$SKIP_TAG_FILE")" == "$latest" ]]; then
    log "skipping $latest (rolled back). Remove $SKIP_TAG_FILE to install it."
    return
  fi

  install_release "$latest" "$tarball_url" "$checksum_url"
  activate "$latest"
  rm -f "$SKIP_TAG_FILE"
  prune
}

cmd_rollback() {
  local active previous
  active="$(current_tag)"
  [[ -n "$active" ]] || die "no active release"
  previous="$(ls -1 "$RELEASES" | sort -V | awk -v active="$active" '$0 == active { print prev; exit } { prev = $0 }')"
  [[ -n "$previous" ]] || die "no release older than $active in $RELEASES"

  echo "$active" >"$SKIP_TAG_FILE"
  activate "$previous"
  restart_app
}

cmd_status() {
  log "active: $(current_tag || true)"
  [[ -f "$SKIP_TAG_FILE" ]] && log "skipped: $(cat "$SKIP_TAG_FILE")"
  log "installed: $(ls -1 "$RELEASES" 2>/dev/null | sort -V | tr '\n' ' ')"
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die "run as root (the sandbox helper must be owned by root)"
  mkdir -p "$RELEASES"
}

main() {
  case "${1:-update}" in
  check) cmd_check ;;
  update) require_root && cmd_update ;;
  rollback) require_root && cmd_rollback ;;
  status) cmd_status ;;
  *) die "unknown command '$1'. Use check, update, rollback or status." ;;
  esac
}

main "$@"
