// REST calls to ksg-nett run here in the main process, not in the window. The
// window asks for them over IPC (preload.js). Chromium's network stack checks
// TLS certificates, and the token never reaches the page.
const { app, net } = require('electron')
const os = require('os')

const API_URL = process.env.XAPP_API_URL || 'https://ksg-nett.samfundet.no/api/'

let token = null

// The backend stores this on the SociSession that the till opens, so the
// admin shows which till and which release opened Soci.
const USER_AGENT = `X-App/${app.getVersion()} (${os.hostname()})`

async function request(method, path, { query, body } = {}) {
  const url = new URL(path, API_URL)
  for (const [key, value] of Object.entries(query || {})) {
    url.searchParams.set(key, value)
  }

  const headers = { Accept: 'application/json', 'User-Agent': USER_AGENT }
  if (token) headers.Authorization = `JWT ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  try {
    const response = await net.fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    // The sliding token lives 24 hours from opening Soci, and the backend
    // cannot extend it (refresh_exp is also 1 day). A 401 on a call that sent
    // the token means it has expired: forget it, and the page shows the login.
    const expired = response.status === 401 && Boolean(headers.Authorization)
    if (expired) token = null
    return { ok: response.ok, status: response.status, data, expired }
  } catch (error) {
    // No connection, DNS or TLS error. status 0 means "no response".
    console.error(error)
    return { ok: false, status: 0, data: null, expired: false }
  }
}

async function obtainToken(cardUuid) {
  token = null
  const response = await request('POST', 'authentication/obtain-token', {
    body: { card_uuid: cardUuid },
  })
  if (response.ok) token = response.data.token
  return { ok: response.ok, status: response.status }
}

const getProducts = () => request('GET', 'economy/products')

const getBalance = cardUuid =>
  request('GET', 'economy/bank-accounts/balance', {
    query: { card_uuid: cardUuid },
  })

const charge = payload => request('POST', 'economy/charge', { body: payload })

async function terminateSession() {
  const response = await request('DELETE', 'economy/sessions/terminate')
  if (response.ok) token = null
  return response
}

// True while Soci is open on this till.
const hasToken = () => token !== null

module.exports = {
  hasToken,
  obtainToken,
  getProducts,
  getBalance,
  charge,
  terminateSession,
}
