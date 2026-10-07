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

export interface UpdateConfig {
  // False when the app runs from a clone (yarn start).
  enabled: boolean
  // How often the login screen checks in the background.
  intervalMs: number
}

// 'installed': a newer release is already in place and only needs a restart.
export type UpdateCheck =
  | { status: 'none' }
  | { status: 'error' }
  | { status: 'available'; tag: string }
  | { status: 'installed'; tag: string }

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
      // True in a packaged build (sentry.js).
      sentryEnabled: boolean
      updateConfig: UpdateConfig
      checkForUpdate(): Promise<UpdateCheck>
      installUpdate(): Promise<{ ok: boolean }>
      // False if Soci is open. Otherwise the app exits and starts the new release.
      restartForUpdate(): Promise<boolean>
    }
  }
}
