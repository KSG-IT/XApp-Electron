[![CodeFactor](https://www.codefactor.io/repository/github/ksg-it/xapp-electron/badge)](https://www.codefactor.io/repository/github/ksg-it/xapp-electron)
[![Known Vulnerabilities](https://snyk.io/test/github/KSG-IT/XApp-Electron/badge.svg?targetFile=package.json)](https://snyk.io/test/github/KSG-IT/XApp-Electron?targetFile=package.json)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![Continuous Integration](https://github.com/KSG-IT/XApp-Electron/workflows/Electron%20CI/badge.svg)](https://github.com/KSG-IT/XApp-Electron/actions?query=branch%3Amaster)

# XApp Electron

<img width="1000" alt="Screenshot" src="https://user-images.githubusercontent.com/6738930/58763842-c762b400-8560-11e9-8764-384f6f25eb9a.png">

This is a version of XApp built using the electron framework.

### Running application

Needs Node.js 22.12 or later (Electron 44).

- Clone the repo and cd into it
- Run `yarn install`
- Run `yarn start`

The app talks to `https://ksg-nett.samfundet.no/api/`. To use another backend, set `XAPP_API_URL`:

```bash
XAPP_API_URL=http://localhost:8000/api/ yarn start
```

#### Watcher mode
Run `yarn watch` during development. This automatically restarts the application on changes.

### Tests

`yarn test` runs end-to-end tests with Playwright. Each test starts the app against a fake API (`test/fakeApi.js`), so no backend is needed. On a Linux machine without a display, run `xvfb-run yarn test`.

### How it is built

| File | Runs in | Role |
|------|---------|------|
| `main.js` | main process | Window, menu (`Escape` cancels, `x` confirms), IPC handlers |
| `apiClient.js` | main process | All REST calls and the token. TLS certificates are checked. |
| `preload.js` | bridge | Exposes `window.xapp` to the pages. Nothing else from Node.js or Electron is available there. |
| `index.html`, `x_view/productView.html`, `assets/js/*.js` | window | Screens and basket logic. The window runs with `sandbox`, `contextIsolation` and no `nodeIntegration`. |

### Ubuntu sandbox

Ubuntu 23.10 and later block the unprivileged user namespaces that Chromium's sandbox needs. If `yarn start` fails with a sandbox error, do one of these:

- Give the bundled sandbox helper its rights (repeat after each `yarn install`):

  ```bash
  sudo chown root:root node_modules/electron/dist/chrome-sandbox
  sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
  ```

- Or allow user namespaces: `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`.

Do not start the app with `--no-sandbox`.
