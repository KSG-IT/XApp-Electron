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

The till updates itself while Soci is closed, from GitHub Releases. Set it up over SSH with one line:

```bash
curl -fsSL https://raw.githubusercontent.com/KSG-IT/XApp-Electron/master/deploy/install.sh | sudo bash -s -- ksg
```

[deploy/README.md](deploy/README.md) has how the update works, what goes where on the till, the commands to use over SSH, and how to remove it.
