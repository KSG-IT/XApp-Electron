[![CodeFactor](https://www.codefactor.io/repository/github/ksg-it/xapp-electron/badge)](https://www.codefactor.io/repository/github/ksg-it/xapp-electron)
[![Known Vulnerabilities](https://snyk.io/test/github/KSG-IT/XApp-Electron/badge.svg?targetFile=package.json)](https://snyk.io/test/github/KSG-IT/XApp-Electron?targetFile=package.json)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![Continuous Integration](https://github.com/KSG-IT/XApp-Electron/workflows/Electron%20CI/badge.svg)](https://github.com/KSG-IT/XApp-Electron/actions?query=branch%3Amaster)

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

1. Set `version` in `package.json`, for example `1.2.0`, and merge to `master`.
2. Tag the merge commit: `git tag v1.2.0 && git push origin v1.2.0`.

CI runs the tests and builds the Linux package. Then it publishes a GitHub Release with `xapp-linux-x64-v1.2.0.tar.gz` and its `.sha256`. CI fails if the tag does not match `package.json`.

Mark a release as a pre-release to keep it from the till. `xapp-update.sh` installs only the latest full release.

### Install and update on the till

The till installs releases with `deploy/xapp-update.sh`. A systemd timer runs it every day at 06:00, when Soci is closed.

| Path | What |
|------|------|
| `/opt/xapp/releases/<tag>/` | One unpacked release. The newest 3 are kept. |
| `/opt/xapp/current` | Symlink to the active release. |
| `/opt/xapp/skip-tag` | A release that the update must not install. `rollback` writes it. |
| `/etc/xapp/update.env` | Config for `xapp-update.sh` (`deploy/update.env.example`). |
| `/etc/xapp/xapp.env` | Optional environment for the app, for example `XAPP_API_URL`. |

Set it up once, from a clone of this repo on the till:

```bash
sudo install -D -m 755 deploy/xapp-update.sh /opt/xapp/bin/xapp-update.sh
sudo install -D -m 644 deploy/update.env.example /etc/xapp/update.env
sudoedit /etc/xapp/update.env    # set XAPP_USER to the desktop user
sudo install -m 644 deploy/systemd/xapp-update.service deploy/systemd/xapp-update.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now xapp-update.timer
sudo /opt/xapp/bin/xapp-update.sh update    # first install
```

Then, as the desktop user, start the app as a user service. It restarts if it crashes:

```bash
install -D -m 644 deploy/systemd/xapp.service ~/.config/systemd/user/xapp.service
systemctl --user daemon-reload
systemctl --user enable --now xapp.service
```

Day to day, over SSH:

```bash
sudo /opt/xapp/bin/xapp-update.sh status      # active and installed releases
sudo /opt/xapp/bin/xapp-update.sh update      # install the latest release now
sudo /opt/xapp/bin/xapp-update.sh rollback    # back to the previous release; skip the current one
journalctl -u xapp-update.service             # update log
```

After a `rollback`, the update skips the bad release until a newer one is published.

`xapp-update.sh` does not update itself. Install it again from the repo when it changes.
