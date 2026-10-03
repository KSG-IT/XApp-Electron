// A small stand-in for the ksg-nett REST API under /api/. The tests start the
// app with XAPP_API_URL pointing here, and check the requests the app sends.
const http = require('http')

const TOKEN = 'test-token'
const OPENER_CARD = '1000'

const PRODUCTS = [
  {
    sku_number: 'OL',
    name: 'Øl',
    price: 30,
    description: 'Pils',
    icon: '🍺',
  },
  {
    sku_number: 'BURGER',
    name: 'Burger',
    price: 80,
    description: 'Med ost',
    icon: '🍔',
  },
  {
    sku_number: 'X-BELOP',
    name: 'Fritt beløp',
    price: 1,
    description: 'Velg beløp',
    icon: '💰',
  },
]

const ACCOUNTS = {
  1111: { id: 1, user: 'Ola Nordmann', balance: 500, soci_gold: false },
  2222: { id: 2, user: 'Blakk Bruker', balance: 10, soci_gold: false },
  3333: { id: 3, user: 'Gull Bruker', balance: 10, soci_gold: true },
  4444: { id: 4, user: 'Lav Saldo', balance: 100, soci_gold: false },
}

function startFakeApi() {
  const requests = []
  // expireToken() makes the server treat the issued token as expired, the
  // same as the backend after SLIDING_TOKEN_LIFETIME (24 hours).
  let tokenExpired = false

  // Each route returns [status, data]. Only obtain-token works without a token.
  const routes = {
    'POST /api/authentication/obtain-token': ({ body }) => {
      if (!body || body.card_uuid !== OPENER_CARD) {
        return [401, { detail: 'No active account found' }]
      }
      tokenExpired = false
      return [200, { token: TOKEN }]
    },
    'GET /api/economy/products': () => [200, PRODUCTS],
    'GET /api/economy/bank-accounts/balance': ({ url }) => {
      const account = ACCOUNTS[url.searchParams.get('card_uuid')]
      return account ? [200, account] : [404, { detail: 'Not found' }]
    },
    'POST /api/economy/charge': () => [200, {}],
    'DELETE /api/economy/sessions/terminate': () => [200, {}],
  }
  const PUBLIC_ROUTES = ['POST /api/authentication/obtain-token']

  function respond(req, url, body) {
    const key = `${req.method} ${url.pathname}`
    const route = routes[key]
    if (!route) return [404, { detail: 'Unknown route' }]

    const authorized =
      req.headers.authorization === `JWT ${TOKEN}` && !tokenExpired
    if (!authorized && !PUBLIC_ROUTES.includes(key)) {
      return [401, { detail: 'Invalid token' }]
    }
    return route({ url, body })
  }

  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', chunk => (raw += chunk))
    req.on('end', () => {
      const url = new URL(req.url, 'http://localhost')
      const body = raw ? JSON.parse(raw) : null
      requests.push({
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        authorization: req.headers.authorization,
        body,
      })

      const [status, data] = respond(req, url, body)
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
    })
  })

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        url: `http://127.0.0.1:${port}/api/`,
        requests,
        expireToken: () => {
          tokenExpired = true
        },
        find: (method, path) =>
          requests.filter(r => r.method === method && r.path === path),
        close: () => new Promise(done => server.close(done)),
      })
    })
  })
}

module.exports = { startFakeApi, TOKEN, OPENER_CARD }
