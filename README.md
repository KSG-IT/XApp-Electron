[![CodeFactor](https://www.codefactor.io/repository/github/ksg-it/xapp-electron/badge)](https://www.codefactor.io/repository/github/ksg-it/xapp-electron)
[![Known Vulnerabilities](https://snyk.io/test/github/KSG-IT/XApp-Electron/badge.svg?targetFile=package.json)](https://snyk.io/test/github/KSG-IT/XApp-Electron?targetFile=package.json)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![Dev build](https://github.com/KSG-IT/XApp-Electron/actions/workflows/dev_build.yml/badge.svg)](https://github.com/KSG-IT/XApp-Electron/actions/workflows/dev_build.yml)

# XApp Electron

<img width="1000" alt="Screenshot" src="https://user-images.githubusercontent.com/6738930/58763842-c762b400-8560-11e9-8764-384f6f25eb9a.png">

This is a version of XApp built using the electron framework.

### Running application

Needs Node.js 22.12 or later (Electron 44); `.nvmrc` pins 22.16.0. Yarn 4.18.1 comes from `packageManager` in `package.json` through corepack, the same as ksg-nett-frontend.

- Clone the repo and cd into it
- Run `corepack enable` (once per machine)
- Run `yarn install`
- Run `yarn start` (builds the window with Vite, then starts Electron)

Electron 44 downloads its binary the first time it starts, not during `yarn install`.

The app talks to `https://ksg-nett.samfundet.no/api/`. To use another backend, set `XAPP_API_URL`:

```bash
XAPP_API_URL=http://localhost:8000/api/ yarn start
```

#### Development
Run these in two terminals. The first rebuilds the window on changes, the second restarts Electron:

```bash
yarn dev
yarn watch
```

### Tests

`yarn test` runs end-to-end tests with Playwright. Each test starts the app against a fake API (`test/fakeApi.js`), so no backend is needed. On a Linux machine without a display, run `xvfb-run yarn test`.

### GitHub Actions

| Workflow | Runs on | Does |
|----------|---------|------|
| Test PR (`test_on_pr.yml`) | a pull request to `master` | Tests, then Package. The PR build is on the run page for 7 days. |
| Dev build (`dev_build.yml`) | a merge to `master` | Tests, then Package. The dev build is on the run page for 14 days. |
| Release (`release.yml`) | a `v*` tag | Checks that the tag is on `master`. Then Tests, Package, and a GitHub Release with the package. |
| Tests (`tests.yml`) | reused by the three above | The Playwright tests, and `deploy/test-update.sh` for the update script. |
| Package (`package.yml`) | reused by the three above | `yarn build-linux`, then `xapp-linux-x64-<version>.tar.gz` and its `.sha256` as a workflow artifact. |

### How it is built

The window uses the same stack as ksg-nett-frontend: React 19, Mantine 9, Vite 8, TypeScript and the same Prettier config.

| Path | Runs in | Role |
|------|---------|------|
| `main.js` | main process | Window, menu (`Escape` cancels, `x` confirms), IPC handlers. Loads `dist/index.html`. |
| `apiClient.js` | main process | All REST calls and the token. TLS certificates are checked. |
| `preload.js` | bridge | Exposes `window.xapp` to the window. Nothing else from Node.js or Electron is available there. |
| `renderer/` | window | Vite root. `src/screens/` (login, products), `src/components/ProductCard.tsx`, the basket reducer in `src/basket.ts`. Built into `dist/`. |

The window runs with `sandbox`, `contextIsolation` and no `nodeIntegration`, and cannot navigate.

### Ubuntu sandbox

Ubuntu 23.10 and later block the unprivileged user namespaces that Chromium's sandbox needs. If `yarn start` fails with a sandbox error, do one of these:

- Give the bundled sandbox helper its rights (repeat after each `yarn install`):

  ```bash
  sudo chown root:root node_modules/electron/dist/chrome-sandbox
  sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
  ```

- Or allow user namespaces: `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`.

Do not start the app with `--no-sandbox`.

### Release

A release is a tag on `master`, the same as in ksg-nett and ksg-nett-frontend. Nothing is edited or committed to make one.

1. `git checkout master && git pull`
2. `yarn release:preview` prints the next tag. It changes nothing.
3. `yarn release` lists the merged PRs since the last tag. Type the tag name to confirm. It creates the tag and pushes it.

Tags are versions in the form `v<year>.<month>.<number>`, for example `v2026.10.4`. The Release workflow refuses a tag that is not on `master`. It runs the tests, sets the app version from the tag and builds the Linux package. Then it publishes a GitHub Release with `xapp-linux-x64-v2026.10.4.tar.gz` and its `.sha256`.

Each merge to `master` also makes a dev build, `xapp-linux-x64-dev-<short sha>.tar.gz`, on the run page of the Dev build workflow. It is kept for 14 days. Download it from the run page to try it on another machine, for example with `XAPP_API_URL` set to the dev backend. The till never installs a dev build.

Mark a release as a pre-release to keep it from the till. `xapp-update.sh` installs only the latest full release.

### Install and update on the till

The app updates itself, but only while Soci is closed:

- at startup, before the login screen,
- each time Soci closes (`Steng soci`, or an expired token),
- every 5 minutes in the background while the login screen shows.

The app shows "Ser etter oppdateringer …" and then "Oppdaterer til <tag> …" instead of the login screen, so nobody can open Soci during an update. Then it restarts on the new release. Without internet, the app goes on to the login screen. The code is in `updater.js` and `renderer/src/screens/UpdateScreen.tsx`. It is on only when the app runs from `/opt/xapp/releases/<tag>/`, never from a clone.

`deploy/xapp-update.sh` does the work. `check` needs no root. `update` runs as root through one sudoers rule, because the Chromium sandbox helper must be owned by root. A systemd timer also runs `update` once a day, as a fallback for an app that cannot start.

| Path | What |
|------|------|
| `/opt/xapp/releases/<tag>/` | One unpacked release. The newest 3 are kept. |
| `/opt/xapp/current` | Symlink to the active release. |
| `/opt/xapp/skip-tag` | A release that the update must not install. `rollback` writes it. |
| `/opt/xapp/bin/xapp-update.sh` | The update script. |
| `/etc/xapp/update.env` | Config for `xapp-update.sh` (`deploy/update.env.example`). |
| `/etc/xapp/xapp.env` | Optional environment for the app, for example `XAPP_API_URL`. |
| `/etc/sudoers.d/xapp` | The till user may run `xapp-update.sh update` as root, and nothing else (`deploy/sudoers.example`). |
| `/etc/systemd/user/xapp.service` | Starts the app when the till user logs in, and again after it exits. |
| `/etc/systemd/system/xapp-update.timer` | The daily fallback. |

Everything is owned by root, and the till user can only read and run it. Nothing is in a home folder, because Ubuntu home folders are closed to other users.

#### Set up

Over SSH, as a user with sudo, when Soci is closed. Replace `v2026.10.2` with the latest release and `ksg` with the till user:

```bash
mkdir -p /tmp/xapp-src && cd /tmp/xapp-src
curl -fsSL https://github.com/KSG-IT/XApp-Electron/archive/refs/tags/v2026.10.2.tar.gz | tar -xz --strip-components=1
sudo deploy/install.sh ksg
```

`install.sh` installs the files in the table, enables the units, and installs the latest release. Then:

1. Remove the old shortcut or autostart entry, so nobody starts a second copy.
2. Close the old app and start the new one: `sudo systemctl --user --machine=ksg@ restart xapp.service`. This needs `ksg` logged in to the desktop. Otherwise the app starts at the next login.

Run `install.sh` again from a newer release when `deploy/` changes. It keeps `/etc/xapp/update.env`.

#### Over SSH

```bash
sudo /opt/xapp/bin/xapp-update.sh status       # active and installed releases
sudo /opt/xapp/bin/xapp-update.sh rollback     # back to the previous release, skip the current one, restart
sudo /opt/xapp/bin/xapp-update.sh update       # install now; the app starts it when Soci is closed
journalctl -u xapp-update.service              # log of the daily timer
sudo journalctl _SYSTEMD_USER_UNIT=xapp.service -n 100   # log of the app and its updates
```

After a `rollback`, the update skips the bad release until a newer one is published.
