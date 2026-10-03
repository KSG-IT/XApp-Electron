import { Button, Divider, Loader, Stack, Text, Title } from '@mantine/core'
import { useEffect, useReducer, useRef, useState } from 'react'
import {
  amountOverBalance,
  basketReducer,
  basketTotal,
  countOf,
  emptyBasket,
  formatKr,
  FREE_AMOUNT_SKU,
  lowestPrice,
} from '../basket'
import { FreeAmountCard, ProductCard } from '../components/ProductCard'
import { useCardReader } from '../useCardReader'
import { colors, useMessage } from '../useMessage'
import type { ApiResponse, MenuItemId, Product } from '../xapp'
import classes from './ProductScreen.module.css'

// loading: products are loading. idle: waiting for a buyer's card.
// lookup: reading the buyer's balance. buyer: the buyer fills the basket.
// charging: the charge request is running.
type Phase = 'loading' | 'idle' | 'lookup' | 'buyer' | 'charging'

interface ProductScreenProps {
  onExpired: () => void
  onClosed: () => void
}

export function ProductScreen({ onExpired, onClosed }: ProductScreenProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [basket, dispatch] = useReducer(basketReducer, emptyBasket)
  const { message, showMessage, clearMessage } = useMessage()

  const total = basketTotal(basket, products)
  const overBalance = amountOverBalance(basket, total)
  const canKryss =
    phase === 'buyer' &&
    !basket.numpadOpen &&
    basket.lines.length > 0 &&
    total > 0 &&
    overBalance === 0
  const canCancel = phase === 'buyer'

  // True if the token has expired; the app then shows the login screen.
  function expired(response: ApiResponse<unknown>) {
    if (response.expired) onExpired()
    return response.expired
  }

  function endPurchase(text: string, color: string, timeout?: number) {
    dispatch({ type: 'reset' })
    setPhase('idle')
    showMessage(text, color, timeout)
  }

  useEffect(() => {
    window.xapp.getProducts().then(response => {
      if (expired(response)) return
      if (!response.ok || !response.data) {
        console.log(response)
        return
      }
      setProducts(response.data)
      setPhase('idle')
    })
    // Load once when Soci opens.
  }, [])

  useCardReader(async card => {
    // One buyer at a time: scans are ignored until Kryss or Avbryt.
    if (phase !== 'idle') return
    setPhase('lookup')

    const response = await window.xapp.getBalance(card)
    if (expired(response)) return
    const account = response.data
    if (response.ok && account) {
      if (account.balance < lowestPrice(products) && !account.soci_gold) {
        endPurchase(
          'Du er enten svart, eller har ikke råd til noe på listen',
          colors.error,
          4000
        )
        return
      }
      clearMessage()
      dispatch({ type: 'buyer', buyer: account })
      setPhase('buyer')
    } else if (response.status === 404) {
      endPurchase(
        'Fant ikke kortnummeret. Har du lagt inn riktig?',
        colors.info
      )
    } else {
      console.log(response)
      setPhase('idle')
    }
  })

  function cancel() {
    if (!canCancel) return
    endPurchase('Kryssing avbrutt!', colors.error)
  }

  async function charge() {
    if (!canKryss || !basket.buyer) return
    setPhase('charging')

    const response = await window.xapp.charge({
      bank_account_id: basket.buyer.id,
      products: basket.lines,
    })
    if (expired(response)) return
    if (response.ok) {
      endPurchase('Kryssing utført!', colors.info)
    } else if (response.status === 402) {
      endPurchase(
        'Kryssingen ble avbrutt: Du har ikke råd til alt dette.',
        colors.error,
        4000
      )
    } else if (response.status === 424) {
      endPurchase(
        'Kryssingen ble avbrutt: Det er ingen aktiv økt.',
        colors.error,
        4000
      )
    } else {
      console.log(response)
      setPhase('buyer')
    }
  }

  async function closeSoci() {
    const response = await window.xapp.terminateSession()
    if (expired(response)) return
    if (response.ok) onClosed()
    else console.log(response)
  }

  // The "Kryss" menu in main.js: Escape cancels and x confirms.
  const menuHandlers = useRef<Record<MenuItemId, () => void>>({
    cancel,
    kryss: charge,
  })
  menuHandlers.current = { cancel, kryss: charge }
  useEffect(
    () => window.xapp.onMenuCommand(command => menuHandlers.current[command]()),
    []
  )
  useEffect(() => {
    window.xapp.setMenuItemEnabled('kryss', canKryss)
    window.xapp.setMenuItemEnabled('cancel', canCancel)
  }, [canKryss, canCancel])
  useEffect(
    () => () => {
      window.xapp.setMenuItemEnabled('kryss', false)
      window.xapp.setMenuItemEnabled('cancel', false)
    },
    []
  )

  const busy = phase === 'loading' || phase === 'lookup' || phase === 'charging'
  const buyer = basket.buyer
  const personText = message?.text ?? buyer?.user ?? 'Les kort...'
  const personColor =
    message?.color ??
    (buyer && buyer.balance < 200 ? colors.lowBalance : colors.text)

  return (
    <div className={classes.layout}>
      <aside className={classes.sidebar}>
        <div className={classes.person}>
          {busy ? (
            <Loader color="gray.0" size={80} />
          ) : (
            <span data-testid="person-name" style={{ color: personColor }}>
              {personText}
            </span>
          )}
        </div>
        <Divider color="gray.0" />
        <Stack gap={0}>
          <Title
            order={2}
            data-testid="total-title"
            style={{ color: overBalance > 0 ? colors.error : colors.text }}
          >
            {overBalance > 0 ? `- ${overBalance} kr` : 'Totalsum'}
          </Title>
          <Text
            data-testid="total-price"
            fz={48}
            fw={700}
            style={{ visibility: overBalance > 0 ? 'hidden' : 'visible' }}
          >
            {formatKr(total)}
          </Text>
        </Stack>
        <Stack gap="sm" mt="md">
          <Button
            data-testid="kryss-button"
            color="green"
            size="xl"
            disabled={!canKryss}
            onClick={charge}
          >
            Kryss (x)
          </Button>
          <Button
            data-testid="cancel-button"
            color="red"
            size="xl"
            disabled={!canCancel}
            onClick={cancel}
          >
            Avbryt (esc)
          </Button>
          <Button
            data-testid="logout-button"
            color="red"
            variant="outline"
            size="xl"
            onClick={closeSoci}
          >
            Steng soci
          </Button>
        </Stack>
      </aside>

      <main
        className={classes.products}
        data-inactive={phase !== 'buyer' || undefined}
      >
        <div className={classes.grid}>
          {products.map(product =>
            product.sku_number === FREE_AMOUNT_SKU ? (
              <FreeAmountCard
                key={product.sku_number}
                product={product}
                amount={countOf(basket, FREE_AMOUNT_SKU)}
                numpadOpen={basket.numpadOpen}
                numpadAmount={basket.numpadAmount}
                onOpen={() => dispatch({ type: 'numpad-open' })}
                onChange={delta => dispatch({ type: 'numpad-change', delta })}
                onConfirm={() => dispatch({ type: 'numpad-confirm' })}
                onDelete={() => dispatch({ type: 'numpad-delete' })}
              />
            ) : (
              <ProductCard
                key={product.sku_number}
                product={product}
                count={countOf(basket, product.sku_number)}
                onAdd={() => dispatch({ type: 'add', sku: product.sku_number })}
                onRemove={() =>
                  dispatch({ type: 'remove', sku: product.sku_number })
                }
              />
            )
          )}
        </div>
      </main>
    </div>
  )
}
