// End-to-end tests for the till flow: open Soci, identify a buyer, fill the
// basket, charge or cancel, close Soci. The app runs against test/fakeApi.js.
const path = require('path')
const { test, expect, _electron: electron } = require('@playwright/test')
const { startFakeApi, TOKEN, OPENER_CARD } = require('./fakeApi')

let api
let app
let page
let pageProblems

async function launch(apiUrl) {
  app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: { ...process.env, XAPP_API_URL: apiUrl },
  })
  page = await app.firstWindow()
  pageProblems = []
  page.on('pageerror', error => pageProblems.push(error.message))
  page.on('console', message => {
    const text = message.text()
    if (
      message.type() === 'error' ||
      text.includes('Content Security Policy') ||
      text.includes('Electron Security Warning')
    )
      pageProblems.push(text)
  })
  // index.html sets its key handler at the end of the page. Keys typed
  // before that are lost.
  await page.waitForLoadState('load')
}

// The card reader types the card number and then Enter.
async function scanCard(card) {
  await page.keyboard.type(card)
  await page.keyboard.press('Enter')
}

async function openSoci() {
  await scanCard(OPENER_CARD)
  await expect(page.getByTestId('product-card')).toHaveCount(3)
  await expect(page.getByTestId('person-name')).toHaveText('Les kort...')
}

async function scanBuyer(card, name) {
  await scanCard(card)
  await expect(page.getByTestId('person-name')).toHaveText(name)
}

// Product cards by sku_number (test/fakeApi.js).
const product = sku =>
  page.locator(`[data-testid="product-card"][data-sku="${sku}"]`)

function menuItemEnabled(id) {
  return app.evaluate(
    ({ Menu }, id) => Menu.getApplicationMenu().getMenuItemById(id).enabled,
    id
  )
}

function clickMenuItem(id) {
  return app.evaluate(
    ({ Menu, BrowserWindow }, id) =>
      Menu.getApplicationMenu()
        .getMenuItemById(id)
        .click(undefined, BrowserWindow.getAllWindows()[0]),
    id
  )
}

test.beforeEach(async () => {
  api = await startFakeApi()
})

test.afterEach(async () => {
  if (app) await app.close()
  expect(pageProblems, 'page errors, CSP or security warnings').toEqual([])
  await api.close()
})

test.describe('open Soci', () => {
  test('a valid card opens the product screen', async () => {
    await launch(api.url)
    await expect(page.getByText('Vennligst skann kortet ditt')).toBeVisible()

    await openSoci()

    const [obtain] = api.find('POST', '/api/authentication/obtain-token')
    expect(obtain.body).toEqual({ card_uuid: OPENER_CARD })
    const [products] = api.find('GET', '/api/economy/products')
    expect(products.authorization).toBe(`JWT ${TOKEN}`)
    await expect(product('OL')).toContainText('30 kr')
  })

  test('a card that cannot open Soci shows a message', async () => {
    await launch(api.url)
    await scanCard('9999')
    await expect(page.getByTestId('login-output')).toHaveText(
      'Sorry! Dette kortnummeret kan ikke brukes til å åpne Soci.'
    )
  })

  test('no connection shows a message', async () => {
    const closed = await startFakeApi()
    const url = closed.url
    await closed.close()

    await launch(url)
    await scanCard(OPENER_CARD)
    await expect(page.getByTestId('login-output')).toHaveText(
      'Oisann, noe gikk galt! Vennligst sjekk om maskinen har internettilkobling.'
    )
  })
})

test.describe('buyer', () => {
  test.beforeEach(async () => {
    await launch(api.url)
    await openSoci()
  })

  test('a scanned card shows the buyer and enables cancel', async () => {
    await scanBuyer('1111', 'Ola Nordmann')

    const [balance] = api.find('GET', '/api/economy/bank-accounts/balance')
    expect(balance.query).toEqual({ card_uuid: '1111' })
    expect(balance.authorization).toBe(`JWT ${TOKEN}`)
    await expect(page.getByTestId('cancel-button')).toBeEnabled()
    await expect(page.getByTestId('kryss-button')).toBeDisabled()
    expect(await menuItemEnabled('cancel')).toBe(true)
    expect(await menuItemEnabled('kryss')).toBe(false)
  })

  test('an unknown card shows a message', async () => {
    await scanCard('0000')
    await expect(page.getByTestId('person-name')).toHaveText(
      'Fant ikke kortnummeret. Har du lagt inn riktig?'
    )
  })

  test('a buyer who cannot afford the cheapest product is refused', async () => {
    await scanCard('2222')
    await expect(page.getByTestId('person-name')).toHaveText(
      'Du er enten svart, eller har ikke råd til noe på listen'
    )
    await expect(page.getByTestId('cancel-button')).toBeDisabled()
  })

  test('soci gold lets a buyer with a low balance in', async () => {
    await scanBuyer('3333', 'Gull Bruker')
  })

  test('a balance under 200 kr shows the name in yellow', async () => {
    await scanBuyer('4444', 'Lav Saldo')
    await expect(page.getByTestId('person-name')).toHaveCSS(
      'color',
      'rgb(255, 255, 0)'
    )
  })
})

// Right after Soci opens, the X-BELOP numpad has no inline display yet. That
// must not count as an open numpad (amountInputIsActive in kryssLogic.js).
test('the first buyer after opening Soci can press Kryss', async () => {
  await launch(api.url)
  await openSoci()
  await scanBuyer('1111', 'Ola Nordmann')
  await product('OL').click()
  await expect(page.getByTestId('kryss-button')).toBeEnabled()
  expect(await menuItemEnabled('kryss')).toBe(true)
})

test.describe('basket', () => {
  test.beforeEach(async () => {
    await launch(api.url)
    await openSoci()
  })

  test('left click adds, right click removes, and Kryss charges', async () => {
    await scanBuyer('1111', 'Ola Nordmann')

    await product('OL').click()
    await product('OL').click()
    await product('BURGER').click()
    await product('OL').click({ button: 'right' })
    await product('OL').click()

    await expect(product('OL').getByTestId('product-badge')).toHaveText('2')
    await expect(product('BURGER').getByTestId('product-badge')).toHaveText('1')
    await expect(page.getByTestId('total-price')).toHaveText('140 kr')
    await expect(page.getByTestId('kryss-button')).toBeEnabled()
    expect(await menuItemEnabled('kryss')).toBe(true)

    await page.getByTestId('kryss-button').click()
    await expect(page.getByTestId('person-name')).toHaveText('Kryssing utført!')

    const [charge] = api.find('POST', '/api/economy/charge')
    expect(charge.authorization).toBe(`JWT ${TOKEN}`)
    expect(charge.body).toEqual({
      bank_account_id: 1,
      products: [
        { sku: 'OL', order_size: 2 },
        { sku: 'BURGER', order_size: 1 },
      ],
    })
    await expect(page.getByTestId('total-price')).toHaveText('0 kr')
    await expect(page.getByTestId('person-name')).toHaveText('Les kort...', {
      timeout: 5000,
    })
  })

  test('the Kryss menu item (x) charges', async () => {
    await scanBuyer('1111', 'Ola Nordmann')
    await product('BURGER').click()

    await clickMenuItem('kryss')
    await expect(page.getByTestId('person-name')).toHaveText('Kryssing utført!')
    expect(api.find('POST', '/api/economy/charge')).toHaveLength(1)
  })

  test('Avbryt clears the basket without a charge', async () => {
    await scanBuyer('1111', 'Ola Nordmann')
    await product('OL').click()

    await page.getByTestId('cancel-button').click()
    await expect(page.getByTestId('person-name')).toHaveText(
      'Kryssing avbrutt!'
    )
    await expect(page.getByTestId('total-price')).toHaveText('0 kr')
    await expect(product('OL').getByTestId('product-badge')).toBeHidden()
    expect(api.find('POST', '/api/economy/charge')).toHaveLength(0)
  })

  test('the Cancel menu item (esc) clears the basket', async () => {
    await scanBuyer('1111', 'Ola Nordmann')
    await product('OL').click()

    await clickMenuItem('cancel')
    await expect(page.getByTestId('person-name')).toHaveText(
      'Kryssing avbrutt!'
    )
    expect(api.find('POST', '/api/economy/charge')).toHaveLength(0)
  })

  test('a total above the balance blocks Kryss', async () => {
    await scanBuyer('4444', 'Lav Saldo')

    await product('BURGER').click()
    await product('OL').click()
    await expect(page.getByTestId('total-title')).toHaveText('- 10 kr')
    await expect(page.getByTestId('kryss-button')).toBeDisabled()
    expect(await menuItemEnabled('kryss')).toBe(false)

    await product('OL').click({ button: 'right' })
    await expect(page.getByTestId('total-title')).toHaveText('Totalsum')
    await expect(page.getByTestId('kryss-button')).toBeEnabled()
  })

  test('X-BELOP charges the amount from the numpad', async () => {
    await scanBuyer('1111', 'Ola Nordmann')
    const card = product('X-BELOP')

    await card.click()
    await card.getByTestId('numpad-plus-10').click()
    await card.getByTestId('numpad-plus-5').click()
    await expect(card.getByTestId('product-price')).toHaveText('15 kr')
    await expect(page.getByTestId('kryss-button')).toBeDisabled()

    await card.getByTestId('numpad-ok').click()
    await expect(card.getByTestId('product-badge')).toHaveText('Aktiv')
    await expect(page.getByTestId('total-price')).toHaveText('15 kr')

    await page.getByTestId('kryss-button').click()
    await expect(page.getByTestId('person-name')).toHaveText('Kryssing utført!')
    const [charge] = api.find('POST', '/api/economy/charge')
    expect(charge.body.products).toEqual([{ sku: 'X-BELOP', order_size: 15 }])
  })
})

test('Steng soci ends the session and returns to the login screen', async () => {
  await launch(api.url)
  await openSoci()

  await page.getByTestId('logout-button').click()
  await expect(page.getByText('Vennligst skann kortet ditt')).toBeVisible()

  const [terminate] = api.find('DELETE', '/api/economy/sessions/terminate')
  expect(terminate.authorization).toBe(`JWT ${TOKEN}`)
})

test.describe('expired token', () => {
  const EXPIRED = 'Økten er utløpt. Skann kortet for å åpne Soci igjen.'

  test.beforeEach(async () => {
    await launch(api.url)
    await openSoci()
  })

  test('a buyer scan returns to the login screen with a message', async () => {
    api.expireToken()
    await scanCard('1111')
    await expect(page.getByTestId('login-output')).toHaveText(EXPIRED)

    // The opener can open Soci again at once.
    await openSoci()
    await scanBuyer('1111', 'Ola Nordmann')
  })

  test('Kryss returns to the login screen with a message', async () => {
    await scanBuyer('1111', 'Ola Nordmann')
    await product('OL').click()
    api.expireToken()

    await page.getByTestId('kryss-button').click()
    await expect(page.getByTestId('login-output')).toHaveText(EXPIRED)
  })

  test('Steng soci returns to the login screen with a message', async () => {
    api.expireToken()
    await page.getByTestId('logout-button').click()
    await expect(page.getByTestId('login-output')).toHaveText(EXPIRED)
  })
})
