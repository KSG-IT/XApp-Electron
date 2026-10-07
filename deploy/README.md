# Deploy: X-App on the till

The files in this folder install the X-App on the till in Soci and keep it up to date. The till is an Ubuntu desktop. A shared desktop user (`ksg`) runs the app. A maintainer with sudo sets it up over SSH.

| File | What |
|------|------|
| `install.sh` | Sets up everything below, then installs the latest release. Safe to run again. |
| `xapp-update.sh` | `check`, `update`, `rollback` and `status` for the releases in `/opt/xapp`. |
| `sudoers.example` | The sudoers rule. `install.sh` writes it with the user name. |
| `update.env.example` | The config for `xapp-update.sh`. |
| `systemd/xapp.service` | The user unit that runs the app. |
| `systemd/xapp-update.service`, `.timer` | The daily fallback update at 06:00. |
| `test-update.sh` | The CI test for `xapp-update.sh`, against a fake GitHub API. |

## How the till updates

The app updates itself, but only while Soci is closed:

- at startup, before the login screen,
- each time Soci closes (`Steng soci`, or an expired token),
- every 5 minutes in the background while the login screen shows.

The app shows "Ser etter oppdateringer …" and then "Oppdaterer til <tag> …" instead of the login screen, so nobody can open Soci during an update. Then it restarts on the new release. Without internet, the app goes on to the login screen. The app code is in `updater.js` and `renderer/src/screens/UpdateScreen.tsx`. Updates are on only when the app runs from `/opt/xapp/releases/<tag>/`, never from a clone.

`xapp-update.sh check` needs no root. `update` runs as root through the sudoers rule, because the Chromium sandbox helper (`chrome-sandbox`) must be owned by root. The timer runs `update` once a day, for a till where the app cannot start.

A release is a `v*` tag on `master`. See the main [README](../README.md) → "Release". The till installs only full releases, not pre-releases or dev builds.

## Set up

Over SSH, as a user with sudo, when Soci is closed. Replace `ksg` with the till user (`id ksg` shows the exact name). Run it from any folder:

```bash
curl -fsSL https://raw.githubusercontent.com/KSG-IT/XApp-Electron/master/deploy/install.sh | sudo bash -s -- ksg
```

Piped like this, `install.sh` downloads the source of the latest release to a temporary folder in `/tmp`, runs the `install.sh` in it, and deletes the folder. Nothing is written to the folder you run it from. To read the script before it runs as root, download it first with `curl -o install.sh`, then run `sudo bash install.sh ksg`. From a copy of the repo, `sudo deploy/install.sh ksg` installs that copy.

Then:

1. Remove the old shortcut or autostart entry, so nobody starts a second copy.
2. Close the old app and start the new one: `sudo systemctl --user --machine=ksg@ restart xapp.service`. This needs `ksg` logged in to the desktop. Otherwise the app starts at the next login.

Run the same line again when `deploy/` changes in a release. It keeps `/etc/xapp/update.env`.

## What goes where

| Path | What | Owner |
|------|------|-------|
| `/opt/xapp/bin/xapp-update.sh` | The update script. | root |
| `/opt/xapp/releases/<tag>/` | One unpacked release. The newest 3 are kept. | root |
| `/opt/xapp/current` | Symlink to the active release. The app runs from here. | root |
| `/opt/xapp/skip-tag` | A release that `update` must not install. Only after a `rollback`. | root |
| `/etc/xapp/update.env` | Config for `xapp-update.sh`, with `XAPP_USER`. Made only if it is missing. | root |
| `/etc/xapp/xapp.env` | Optional, not made by `install.sh`. Environment for the app, for example `XAPP_API_URL`. | root |
| `/etc/sudoers.d/xapp` | The till user may run `/opt/xapp/bin/xapp-update.sh update` as root, and nothing else. | root |
| `/etc/systemd/system/xapp-update.service`, `.timer` | The daily fallback update. | root |
| `/etc/systemd/user/xapp.service` | Starts the app when the till user logs in, and again after it exits. | root |
| `~ksg/.config/systemd/user/graphical-session.target.wants/xapp.service` | The only file in a home folder: a symlink that enables `xapp.service` for the till user only. | ksg |

The till user can read and run the files owned by root, but cannot change them. The app is not in a home folder, because Ubuntu home folders are closed to other users.

`install.sh` does not touch an old copy of the app (for example a clone in a home folder), or the shortcut that starts it. Remove them yourself when the new setup works.

## Over SSH

```bash
sudo /opt/xapp/bin/xapp-update.sh status       # active and installed releases
sudo /opt/xapp/bin/xapp-update.sh rollback     # back to the previous release, skip the current one, restart
sudo /opt/xapp/bin/xapp-update.sh update       # install now; the app starts it when Soci is closed
journalctl -u xapp-update.service              # log of the daily timer
sudo journalctl _SYSTEMD_USER_UNIT=xapp.service -n 100   # log of the app and its updates
```

After a `rollback`, the update skips the bad release until a newer one is published.

Errors and crashes of the app also go to Sentry (`ksg-it/xapp-electron`) and to `#ksg-nett` in Slack.

## Remove

```bash
sudo systemctl disable --now xapp-update.timer
sudo systemctl --user --machine=ksg@ stop xapp.service
sudo rm -rf /opt/xapp /etc/xapp /etc/sudoers.d/xapp \
  /etc/systemd/system/xapp-update.service /etc/systemd/system/xapp-update.timer \
  /etc/systemd/user/xapp.service \
  ~ksg/.config/systemd/user/graphical-session.target.wants/xapp.service
sudo systemctl daemon-reload
```
