// A small stand-in for the ksg-nett REST API under /api/. The tests start the
// app with XAPP_API_URL pointing here, and check the requests the app sends.
const http = require("http");

const TOKEN = "test-token";
const OPENER_CARD = "1000";

const PRODUCTS = [
  {
    sku_number: "OL",
    name: "Øl",
    price: 30,
    description: "Pils",
    icon: "🍺",
  },
  {
    sku_number: "BURGER",
    name: "Burger",
    price: 80,
    description: "Med ost",
    icon: "🍔",
  },
  {
    sku_number: "X-BELOP",
    name: "Fritt beløp",
    price: 1,
    description: "Velg beløp",
    icon: "💰",
  },
];

const ACCOUNTS = {
  1111: { id: 1, user: "Ola Nordmann", balance: 500, soci_gold: false },
  2222: { id: 2, user: "Blakk Bruker", balance: 10, soci_gold: false },
  3333: { id: 3, user: "Gull Bruker", balance: 10, soci_gold: true },
  4444: { id: 4, user: "Lav Saldo", balance: 100, soci_gold: false },
};

function startFakeApi() {
  const requests = [];

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const url = new URL(req.url, "http://localhost");
      const body = raw ? JSON.parse(raw) : null;
      requests.push({
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        authorization: req.headers.authorization,
        body,
      });

      const send = (status, data) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(data === undefined ? "" : JSON.stringify(data));
      };
      const authorized = req.headers.authorization === `JWT ${TOKEN}`;

      if (
        req.method === "POST" &&
        url.pathname === "/api/authentication/obtain-token"
      ) {
        if (body && body.card_uuid === OPENER_CARD)
          return send(200, { token: TOKEN });
        return send(401, { detail: "No active account found" });
      }
      if (!authorized) return send(401, { detail: "Invalid token" });

      if (req.method === "GET" && url.pathname === "/api/economy/products") {
        return send(200, PRODUCTS);
      }
      if (
        req.method === "GET" &&
        url.pathname === "/api/economy/bank-accounts/balance"
      ) {
        const account = ACCOUNTS[url.searchParams.get("card_uuid")];
        return account
          ? send(200, account)
          : send(404, { detail: "Not found" });
      }
      if (req.method === "POST" && url.pathname === "/api/economy/charge") {
        return send(200, {});
      }
      if (
        req.method === "DELETE" &&
        url.pathname === "/api/economy/sessions/terminate"
      ) {
        return send(200, {});
      }
      return send(404, { detail: "Unknown route" });
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}/api/`,
        requests,
        find: (method, path) =>
          requests.filter((r) => r.method === method && r.path === path),
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

module.exports = { startFakeApi, TOKEN, OPENER_CARD };
