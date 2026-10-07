// Errors and crashes go to the Sentry project ksg-it/xapp-electron. Only a
// packaged build reports: a release or a dev build from CI, not `yarn start`
// and not the tests. A DSN only lets a client send events, like the DSN in
// ksg-nett-frontend. Load this file first in main.js.
const { app } = require('electron')
const Sentry = require('@sentry/electron/main')

const DSN =
  'https://f120eeaaef4f2ac8721965b16348e65d@o487192.ingest.us.sentry.io/4512216844009472'

const enabled = app.isPackaged

if (enabled) {
  // CI sets the version: 2026.10.3 for a release, 0.0.0-dev.<sha> for a dev
  // build (.github/workflows/package.yml).
  const version = app.getVersion()
  Sentry.init({
    dsn: DSN,
    release: `xapp-electron@${version}`,
    environment: version.includes('-dev') ? 'development' : 'production',
    sendDefaultPii: false,
  })
}

module.exports = { enabled }
