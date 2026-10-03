// window.xapp from preload.js. The REST calls run in the main process
// (apiClient.js).

export interface ApiResponse<T> {
  ok: boolean
  // 0 means no response (no connection, DNS or TLS error).
  status: number
  data: T | null
  // A 401 on a call that sent the token: it has expired (24 hours).
  expired: boolean
}

export interface Product {
  sku_number: string
  name: string
  price: number
  description: string
  icon: string
}

export interface BankAccount {
  id: number
  user: string
  balance: number
  soci_gold: boolean
}

export interface OrderLine {
  sku: string
  order_size: number
}

export interface ChargePayload {
  bank_account_id: number
  products: OrderLine[]
}

export type MenuItemId = 'kryss' | 'cancel'

declare global {
  interface Window {
    xapp: {
      obtainToken(
        cardUuid: string
      ): Promise<Pick<ApiResponse<never>, 'ok' | 'status'>>
      getProducts(): Promise<ApiResponse<Product[]>>
      getBalance(cardUuid: string): Promise<ApiResponse<BankAccount>>
      charge(payload: ChargePayload): Promise<ApiResponse<unknown>>
      terminateSession(): Promise<ApiResponse<unknown>>
      setMenuItemEnabled(id: MenuItemId, enabled: boolean): void
      onMenuCommand(callback: (command: MenuItemId) => void): () => void
    }
  }
}
