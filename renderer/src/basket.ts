import type { BankAccount, OrderLine, Product } from './xapp'

// The product with this sku is a free amount: the buyer chooses an amount in
// kr with the numpad, and the till sends it as order_size.
export const FREE_AMOUNT_SKU = 'X-BELOP'

export interface BasketState {
  buyer: BankAccount | null
  // In the order the products were first added. The X-BELOP line holds the
  // amount in kr.
  lines: OrderLine[]
  numpadOpen: boolean
  // The amount on the numpad while it is open.
  numpadAmount: number
}

export type BasketAction =
  | { type: 'buyer'; buyer: BankAccount }
  | { type: 'add'; sku: string }
  | { type: 'remove'; sku: string }
  | { type: 'numpad-open' }
  | { type: 'numpad-change'; delta: number }
  | { type: 'numpad-confirm' }
  | { type: 'numpad-delete' }
  | { type: 'reset' }

export const emptyBasket: BasketState = {
  buyer: null,
  lines: [],
  numpadOpen: false,
  numpadAmount: 0,
}

function withCount(lines: OrderLine[], sku: string, count: number) {
  if (count <= 0) return lines.filter(line => line.sku !== sku)
  if (!lines.some(line => line.sku === sku)) {
    return [...lines, { sku, order_size: count }]
  }
  return lines.map(line =>
    line.sku === sku ? { sku, order_size: count } : line
  )
}

export function countOf(state: BasketState, sku: string) {
  return state.lines.find(line => line.sku === sku)?.order_size ?? 0
}

export function basketReducer(
  state: BasketState,
  action: BasketAction
): BasketState {
  switch (action.type) {
    case 'buyer':
      return { ...emptyBasket, buyer: action.buyer }
    case 'add':
      return {
        ...state,
        lines: withCount(
          state.lines,
          action.sku,
          countOf(state, action.sku) + 1
        ),
      }
    case 'remove':
      return {
        ...state,
        lines: withCount(
          state.lines,
          action.sku,
          countOf(state, action.sku) - 1
        ),
      }
    case 'numpad-open':
      return {
        ...state,
        numpadOpen: true,
        numpadAmount: countOf(state, FREE_AMOUNT_SKU),
      }
    case 'numpad-change':
      return {
        ...state,
        numpadAmount: Math.max(0, state.numpadAmount + action.delta),
      }
    case 'numpad-confirm':
      return {
        ...state,
        numpadOpen: false,
        lines: withCount(state.lines, FREE_AMOUNT_SKU, state.numpadAmount),
      }
    case 'numpad-delete':
      return {
        ...state,
        numpadOpen: false,
        numpadAmount: 0,
        lines: withCount(state.lines, FREE_AMOUNT_SKU, 0),
      }
    case 'reset':
      return emptyBasket
  }
}

export function basketTotal(state: BasketState, products: Product[]) {
  const price = (sku: string) =>
    products.find(product => product.sku_number === sku)?.price ?? 0
  const lines = state.lines.filter(line => line.sku !== FREE_AMOUNT_SKU)
  const freeAmount = state.numpadOpen
    ? state.numpadAmount
    : countOf(state, FREE_AMOUNT_SKU)
  return (
    lines.reduce((sum, line) => sum + line.order_size * price(line.sku), 0) +
    freeAmount
  )
}

// How much the total is above the balance, or 0. Soci gold has no limit.
export function amountOverBalance(state: BasketState, total: number) {
  if (!state.buyer || state.buyer.soci_gold) return 0
  return Math.max(0, total - state.buyer.balance)
}

// The cheapest product with a fixed price. A buyer who cannot pay for it,
// and has no Soci gold, is refused.
export function lowestPrice(products: Product[]) {
  const prices = products
    .filter(product => product.sku_number !== FREE_AMOUNT_SKU)
    .map(product => product.price)
  return prices.length ? Math.min(...prices) : Infinity
}

export function formatKr(amount: number) {
  return `${amount.toLocaleString('nb-NO')} kr`
}
