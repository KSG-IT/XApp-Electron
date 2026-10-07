// Updates on the till. The window asks for a check before Soci opens: at startup,
// after Soci closes, and every few minutes on the login screen. The work is done
// by deploy/xapp-update.sh (README.md → "Install and update on the till").
//
// Updates are on only when the app runs from an installed release
// (/opt/xapp/releases/<tag>/X-App), or when XAPP_UPDATER names a script (tests).
// `yarn start` from a clone never updates.
const { app } = require('electron')
const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')
const api = require('./apiClient')

const ROOT = process.env.XAPP_ROOT || '/opt/xapp'
const SCRIPT = process.env.XAPP_UPDATER || path.join(ROOT, 'bin/xapp-update.sh')
// `update` must run as root. On the till a sudoers rule allows exactly that
// command (deploy/sudoers.example). A test script runs without sudo.
const UPDATE_COMMAND = process.env.XAPP_UPDATER
  ? [SCRIPT, ['update']]
  : ['sudo', ['-n', SCRIPT, 'update']]
const INTERVAL_MS = Number(process.env.XAPP_UPDATE_INTERVAL_MS) || 5 * 60 * 1000

// The release folder this process runs from, or null when it runs from a clone.
function runningRelease() {
  try {
    const dir = path.dirname(fs.realpathSync(process.execPath))
    return path.dirname(dir) === path.join(ROOT, 'releases') ? dir : null
  } catch {
    return null
  }
}

function currentRelease() {
  try {
    return fs.realpathSync(path.join(ROOT, 'current'))
  } catch {
    return null
  }
}

const enabled = Boolean(process.env.XAPP_UPDATER) || runningRelease() !== null

function run(file, args, timeout) {
  return new Promise(resolve => {
    execFile(file, args, { timeout }, (error, stdout, stderr) => {
      if (error)
        console.error(`${file} ${args.join(' ')}:`, error.message, stderr)
      resolve({ ok: !error, stdout: String(stdout).trim() })
    })
  })
}

// { status: 'none' | 'available' | 'installed' | 'error', tag? }
// 'installed': a newer release is already in place (the daily timer or SSH).
async function check() {
  const running = runningRelease()
  const current = currentRelease()
  if (running && current && running !== current) {
    return { status: 'installed', tag: path.basename(current) }
  }

  const result = await run(SCRIPT, ['check'], 30 * 1000)
  if (!result.ok) return { status: 'error' }
  const [word, tag] = result.stdout.split(/\s+/)
  return word === 'available'
    ? { status: 'available', tag }
    : { status: 'none' }
}

async function install() {
  const [file, args] = UPDATE_COMMAND
  const result = await run(file, args, 15 * 60 * 1000)
  return { ok: result.ok }
}

// Starts the new release. Under xapp.service (INVOCATION_ID is set), systemd
// starts it again after the exit. Started by hand, the app starts it itself.
function restart() {
  // Never in the middle of an open Soci.
  if (api.hasToken()) return false

  const current = currentRelease()
  if (!process.env.INVOCATION_ID && runningRelease() && current) {
    app.relaunch({
      execPath: path.join(current, 'X-App'),
      args: process.argv.slice(1),
    })
  }
  app.exit(0)
  return true
}

module.exports = { enabled, intervalMs: INTERVAL_MS, check, install, restart }
