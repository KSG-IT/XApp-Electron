#!/usr/bin/env bash
# Sets up X-App updates on the till. One line, without a copy of the repo:
#
#   curl -fsSL https://raw.githubusercontent.com/KSG-IT/XApp-Electron/master/deploy/install.sh | sudo bash -s -- <till user>
#
# Piped like this, the script downloads the source of the latest release and
# runs the install.sh in it. From an unpacked copy of the repo it installs
# that copy:
#
#   sudo deploy/install.sh <till user>
#
# Run it again after a release that changes deploy/. It replaces the script,
# the units and the sudoers rule, and keeps /etc/xapp/update.env.
#
# All the code is in functions and runs from the last line, so a download that
# stops halfway runs nothing.
set -euo pipefail

REPO="KSG-IT/XApp-Electron"
DOWNLOAD_DIR=""
trap 'rm -rf "$DOWNLOAD_DIR"' EXIT

die() {
  echo "install.sh: error: $*" >&2
  exit 1
}
step() { echo "--- $*"; }

# Piped into bash, there are no files next to the script. Get them from the
# latest release, so the deploy files match the release that gets installed.
install_from_latest_release() {
  [[ -z "${XAPP_INSTALL_DOWNLOADED:-}" ]] || die "the downloaded source has no deploy/ files"

  local tag
  tag="$(curl -fsSL --max-time 15 "https://api.github.com/repos/$REPO/releases/latest" |
    python3 -c 'import json, sys; print(json.load(sys.stdin)["tag_name"])')" ||
    die "could not read the latest release of $REPO"
  DOWNLOAD_DIR="$(mktemp -d)"
  local tmp="$DOWNLOAD_DIR"

  step "source of $tag"
  curl -fsSL --max-time 300 "https://github.com/$REPO/archive/refs/tags/$tag.tar.gz" |
    tar -xz -C "$tmp" --strip-components=1
  [[ -f "$tmp/deploy/install.sh" ]] || die "$tag has no deploy/install.sh. Release a newer version first."

  XAPP_INSTALL_DOWNLOADED=1 bash "$tmp/deploy/install.sh" "$@"
}

install_from() {
  local src="$1" till_user="$2"

  step "update script: /opt/xapp/bin/xapp-update.sh"
  install -D -o root -g root -m 755 "$src/xapp-update.sh" /opt/xapp/bin/xapp-update.sh

  step "config: /etc/xapp/update.env"
  if [[ -f /etc/xapp/update.env ]]; then
    echo "exists, not changed"
  else
    install -D -o root -g root -m 644 "$src/update.env.example" /etc/xapp/update.env
    sed -i "s/^XAPP_USER=\$/XAPP_USER=$till_user/" /etc/xapp/update.env
  fi

  # visudo checks the file first. A broken sudoers file can lock out sudo.
  step "sudoers rule: /etc/sudoers.d/xapp"
  local rule
  rule="$(mktemp)"
  sed "s/^XAPP_USER /$till_user /" "$src/sudoers.example" >"$rule"
  visudo -cqf "$rule" || die "the sudoers rule is not valid"
  install -o root -g root -m 440 "$rule" /etc/sudoers.d/xapp
  rm -f "$rule"

  step "daily fallback timer: xapp-update.timer"
  install -o root -g root -m 644 "$src/systemd/xapp-update.service" "$src/systemd/xapp-update.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now xapp-update.timer

  step "app unit: /etc/systemd/user/xapp.service, enabled for $till_user only"
  install -D -o root -g root -m 644 "$src/systemd/xapp.service" /etc/systemd/user/xapp.service
  # The same link that `systemctl --user enable` makes, so the user need not be logged in.
  local wants
  wants="$(getent passwd "$till_user" | cut -d: -f6)/.config/systemd/user/graphical-session.target.wants"
  runuser -u "$till_user" -- mkdir -p "$wants"
  runuser -u "$till_user" -- ln -sfn /etc/systemd/user/xapp.service "$wants/xapp.service"
  systemctl --user --machine="$till_user@" daemon-reload 2>/dev/null || true

  step "latest release"
  /opt/xapp/bin/xapp-update.sh update
  /opt/xapp/bin/xapp-update.sh status

  cat <<EOT

Done. The app starts when $till_user logs in to the desktop.
To start it now, while $till_user is logged in:
  sudo systemctl --user --machine=$till_user@ restart xapp.service
Remove any old shortcut or autostart entry that starts another copy.
EOT
}

main() {
  [[ "$(id -u)" -eq 0 ]] || die "run with sudo"
  local till_user="${1:-}"
  [[ -n "$till_user" ]] || die "usage: sudo deploy/install.sh <till user>"
  id "$till_user" >/dev/null 2>&1 || die "no user '$till_user'"

  # BASH_SOURCE is empty when the script comes from a pipe.
  local src=""
  if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
    src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  fi

  if [[ -n "$src" && -f "$src/xapp-update.sh" ]]; then
    install_from "$src" "$till_user"
  else
    install_from_latest_release "$@"
  fi
}

main "$@"
