// End-to-end tests for the till flow: open Soci, identify a buyer, fill the
// basket, charge or cancel, close Soci. The app runs against test/fakeApi.js.
const path = require("path");
const { test, expect, _electron: electron } = require("@playwright/test");
const { startFakeApi, TOKEN, OPENER_CARD } = require("./fakeApi");

let api;
let app;
let page;
let pageProblems;

async function launch(apiUrl) {
  app = await electron.launch({
    args: [path.join(__dirname, "..")],
    env: { ...process.env, XAPP_API_URL: apiUrl },
  });
  page = await app.firstWindow();
  pageProblems = [];
  page.on("pageerror", (error) => pageProblems.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (
      message.type() === "error" ||
      text.includes("Content Security Policy") ||
      text.includes("Electron Security Warning")
    )
      pageProblems.push(text);
  });
  // index.html sets its key handler at the end of the page. Keys typed
  // before that are lost.
  await page.waitForLoadState("load");
}

// The card reader types the card number and then Enter.
async function scanCard(card) {
  await page.keyboard.type(card);
  await page.keyboard.press("Enter");
}

async function openSoci() {
  await scanCard(OPENER_CARD);
  await expect(page.locator(".grid-item")).toHaveCount(3);
  await expect(page.locator("#personName")).toHaveText("Les kort...");
}

async function scanBuyer(card, name) {
  await scanCard(card);
  await expect(page.locator("#personName")).toHaveText(name);
}

const product = (name) => page.locator(".grid-item", { hasText: name });

function menuItemEnabled(id) {
  return app.evaluate(
    ({ Menu }, id) => Menu.getApplicationMenu().getMenuItemById(id).enabled,
    id
  );
}

function clickMenuItem(id) {
  return app.evaluate(
    ({ Menu, BrowserWindow }, id) =>
      Menu.getApplicationMenu()
        .getMenuItemById(id)
        .click(undefined, BrowserWindow.getAllWindows()[0]),
    id
  );
}

test.beforeEach(async () => {
  api = await startFakeApi();
});

test.afterEach(async () => {
  if (app) await app.close();
  expect(pageProblems, "page errors, CSP or security warnings").toEqual([]);
  await api.close();
});

test.describe("open Soci", () => {
  test("a valid card opens the product screen", async () => {
    await launch(api.url);
    await expect(
      page.locator("text=Vennligst skann kortet ditt")
    ).toBeVisible();

    await openSoci();

    const [obtain] = api.find("POST", "/api/authentication/obtain-token");
    expect(obtain.body).toEqual({ card_uuid: OPENER_CARD });
    const [products] = api.find("GET", "/api/economy/products");
    expect(products.authorization).toBe(`JWT ${TOKEN}`);
    await expect(product("Øl")).toContainText("30 kr");
  });

  test("a card that cannot open Soci shows a message", async () => {
    await launch(api.url);
    await scanCard("9999");
    await expect(page.locator("#loginOutput")).toHaveText(
      "Sorry! Dette kortnummeret kan ikke brukes til å åpne Soci."
    );
  });

  test("no connection shows a message", async () => {
    const closed = await startFakeApi();
    const url = closed.url;
    await closed.close();

    await launch(url);
    await scanCard(OPENER_CARD);
    await expect(page.locator("#loginOutput")).toHaveText(
      "Oisann, noe gikk galt! Vennligst sjekk om maskinen har internettilkobling."
    );
  });
});

test.describe("buyer", () => {
  test.beforeEach(async () => {
    await launch(api.url);
    await openSoci();
  });

  test("a scanned card shows the buyer and enables cancel", async () => {
    await scanBuyer("1111", "Ola Nordmann");

    const [balance] = api.find("GET", "/api/economy/bank-accounts/balance");
    expect(balance.query).toEqual({ card_uuid: "1111" });
    expect(balance.authorization).toBe(`JWT ${TOKEN}`);
    await expect(page.locator("#cancelButton")).toBeEnabled();
    await expect(page.locator("#kryssButton")).toBeDisabled();
    expect(await menuItemEnabled("cancel")).toBe(true);
    expect(await menuItemEnabled("kryss")).toBe(false);
  });

  test("an unknown card shows a message", async () => {
    await scanCard("0000");
    await expect(page.locator("#personName")).toHaveText(
      "Fant ikke kortnummeret. Har du lagt inn riktig?"
    );
  });

  test("a buyer who cannot afford the cheapest product is refused", async () => {
    await scanCard("2222");
    await expect(page.locator("#personName")).toHaveText(
      "Du er enten svart, eller har ikke råd til noe på listen"
    );
    await expect(page.locator("#cancelButton")).toBeDisabled();
  });

  test("soci gold lets a buyer with a low balance in", async () => {
    await scanBuyer("3333", "Gull Bruker");
  });

  test("a balance under 200 kr shows the name in yellow", async () => {
    await scanBuyer("4444", "Lav Saldo");
    await expect(page.locator("#personName")).toHaveCSS(
      "color",
      "rgb(255, 255, 0)"
    );
  });
});

// Right after Soci opens, the X-BELOP numpad has no inline display yet. That
// must not count as an open numpad (amountInputIsActive in kryssLogic.js).
test("the first buyer after opening Soci can press Kryss", async () => {
  await launch(api.url);
  await openSoci();
  await scanBuyer("1111", "Ola Nordmann");
  await product("Øl").click();
  await expect(page.locator("#kryssButton")).toBeEnabled();
  expect(await menuItemEnabled("kryss")).toBe(true);
});

test.describe("basket", () => {
  test.beforeEach(async () => {
    await launch(api.url);
    await openSoci();
  });

  test("left click adds, right click removes, and Kryss charges", async () => {
    await scanBuyer("1111", "Ola Nordmann");

    await product("Øl").click();
    await product("Øl").click();
    await product("Burger").click();
    await product("Øl").click({ button: "right" });
    await product("Øl").click();

    await expect(product("Øl").locator(".badge")).toHaveText("2");
    await expect(product("Burger").locator(".badge")).toHaveText("1");
    await expect(page.locator("#totalPrice")).toHaveText("140 kr");
    await expect(page.locator("#kryssButton")).toBeEnabled();
    expect(await menuItemEnabled("kryss")).toBe(true);

    await page.locator("#kryssButton").click();
    await expect(page.locator("#personName")).toHaveText("Kryssing utført!");

    const [charge] = api.find("POST", "/api/economy/charge");
    expect(charge.authorization).toBe(`JWT ${TOKEN}`);
    expect(charge.body).toEqual({
      bank_account_id: 1,
      products: [
        { sku: "OL", order_size: 2 },
        { sku: "BURGER", order_size: 1 },
      ],
    });
    await expect(page.locator("#totalPrice")).toHaveText("0 kr");
    await expect(page.locator("#personName")).toHaveText("Les kort...", {
      timeout: 5000,
    });
  });

  test("the Kryss menu item (x) charges", async () => {
    await scanBuyer("1111", "Ola Nordmann");
    await product("Burger").click();

    await clickMenuItem("kryss");
    await expect(page.locator("#personName")).toHaveText("Kryssing utført!");
    expect(api.find("POST", "/api/economy/charge")).toHaveLength(1);
  });

  test("Avbryt clears the basket without a charge", async () => {
    await scanBuyer("1111", "Ola Nordmann");
    await product("Øl").click();

    await page.locator("#cancelButton").click();
    await expect(page.locator("#personName")).toHaveText("Kryssing avbrutt!");
    await expect(page.locator("#totalPrice")).toHaveText("0 kr");
    await expect(product("Øl").locator(".badge")).toBeHidden();
    expect(api.find("POST", "/api/economy/charge")).toHaveLength(0);
  });

  test("the Cancel menu item (esc) clears the basket", async () => {
    await scanBuyer("1111", "Ola Nordmann");
    await product("Øl").click();

    await clickMenuItem("cancel");
    await expect(page.locator("#personName")).toHaveText("Kryssing avbrutt!");
    expect(api.find("POST", "/api/economy/charge")).toHaveLength(0);
  });

  test("a total above the balance blocks Kryss", async () => {
    await scanBuyer("4444", "Lav Saldo");

    await product("Burger").click();
    await product("Øl").click();
    await expect(page.locator("#totalPriceTitle")).toHaveText("- 10 kr");
    await expect(page.locator("#kryssButton")).toBeDisabled();
    expect(await menuItemEnabled("kryss")).toBe(false);

    await product("Øl").click({ button: "right" });
    await expect(page.locator("#totalPriceTitle")).toHaveText("Totalsum");
    await expect(page.locator("#kryssButton")).toBeEnabled();
  });

  test("X-BELOP charges the amount from the numpad", async () => {
    await scanBuyer("1111", "Ola Nordmann");
    const card = product("Fritt beløp");

    await card.click();
    await card.locator(".numpad-btn", { hasText: "+10" }).click();
    await card.locator(".numpad-btn", { hasText: "+5" }).click();
    await expect(card.locator(".card-subtitle")).toHaveText("15 kr");
    await expect(page.locator("#kryssButton")).toBeDisabled();

    await card.locator(".numpad-btn", { hasText: "OK" }).click();
    await expect(card.locator(".badge")).toHaveText("Aktiv");
    await expect(page.locator("#totalPrice")).toHaveText("15 kr");

    await page.locator("#kryssButton").click();
    await expect(page.locator("#personName")).toHaveText("Kryssing utført!");
    const [charge] = api.find("POST", "/api/economy/charge");
    expect(charge.body.products).toEqual([{ sku: "X-BELOP", order_size: 15 }]);
  });
});

test("Steng soci ends the session and returns to the login screen", async () => {
  await launch(api.url);
  await openSoci();

  await page.locator("#logoutButton").click();
  await expect(page.locator("text=Vennligst skann kortet ditt")).toBeVisible();

  const [terminate] = api.find("DELETE", "/api/economy/sessions/terminate");
  expect(terminate.authorization).toBe(`JWT ${TOKEN}`);
});
