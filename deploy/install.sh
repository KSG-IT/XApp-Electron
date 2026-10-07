#!/usr/bin/env bash
# Sets up X-App updates on the till. Run it from an unpacked copy of this repo:
#
#   sudo deploy/install.sh <till user>
#
# Run it again after a release that changes deploy/. It replaces the script,
# the units and the sudoers rule, and keeps /etc/xapp/update.env.
set -euo pipefail

die() {
  echo "install.sh: error: $*" >&2
  exit 1
}
step() { echo "--- $*"; }

[[ "$(id -u)" -eq 0 ]] || die "run with sudo"
TILL_USER="${1:-}"
[[ -n "$TILL_USER" ]] || die "usage: sudo deploy/install.sh <till user>"
id "$TILL_USER" >/dev/null 2>&1 || die "no user '$TILL_USER'"
SRC="$(cd "$(dirname "$0")" && pwd)"

step "update script: /opt/xapp/bin/xapp-update.sh"
install -D -o root -g root -m 755 "$SRC/xapp-update.sh" /opt/xapp/bin/xapp-update.sh

step "config: /etc/xapp/update.env"
if [[ -f /etc/xapp/update.env ]]; then
  echo "exists, not changed"
else
  install -D -o root -g root -m 644 "$SRC/update.env.example" /etc/xapp/update.env
  sed -i "s/^XAPP_USER=\$/XAPP_USER=$TILL_USER/" /etc/xapp/update.env
fi

# visudo checks the file first. A broken sudoers file can lock out sudo.
step "sudoers rule: /etc/sudoers.d/xapp"
tmp="$(mktemp)"
sed "s/^XAPP_USER /$TILL_USER /" "$SRC/sudoers.example" >"$tmp"
visudo -cqf "$tmp" || die "the sudoers rule is not valid"
install -o root -g root -m 440 "$tmp" /etc/sudoers.d/xapp
rm -f "$tmp"

step "daily fallback timer: xapp-update.timer"
install -o root -g root -m 644 "$SRC/systemd/xapp-update.service" "$SRC/systemd/xapp-update.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now xapp-update.timer

step "app unit: /etc/systemd/user/xapp.service, enabled for $TILL_USER only"
install -D -o root -g root -m 644 "$SRC/systemd/xapp.service" /etc/systemd/user/xapp.service
# The same link that `systemctl --user enable` makes, so the user need not be logged in.
wants="$(getent passwd "$TILL_USER" | cut -d: -f6)/.config/systemd/user/graphical-session.target.wants"
runuser -u "$TILL_USER" -- mkdir -p "$wants"
runuser -u "$TILL_USER" -- ln -sfn /etc/systemd/user/xapp.service "$wants/xapp.service"
systemctl --user --machine="$TILL_USER@" daemon-reload 2>/dev/null || true

step "latest release"
/opt/xapp/bin/xapp-update.sh update
/opt/xapp/bin/xapp-update.sh status

cat <<EOT

Done. The app starts when $TILL_USER logs in to the desktop.
To start it now, while $TILL_USER is logged in:
  sudo systemctl --user --machine=$TILL_USER@ restart xapp.service
Remove any old shortcut or autostart entry that starts another copy.
EOT
