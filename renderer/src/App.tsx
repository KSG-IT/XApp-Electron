import { useState } from 'react'
import { LoginScreen } from './screens/LoginScreen'
import { ProductScreen } from './screens/ProductScreen'
import { UpdateScreen } from './screens/UpdateScreen'
import { useUpdatePolling } from './useUpdatePolling'

type Screen =
  | { name: 'update'; expired: boolean }
  | { name: 'login'; expired: boolean }
  | { name: 'products' }

// Soci is closed. A till that updates itself looks for an update first
// (updater.js). `expired` goes on to the login screen.
function closedScreen(expired: boolean): Screen {
  return window.xapp.updateConfig.enabled
    ? { name: 'update', expired }
    : { name: 'login', expired }
}

export function App() {
  const [screen, setScreen] = useState<Screen>(() => closedScreen(false))

  useUpdatePolling(
    window.xapp.updateConfig.enabled && screen.name === 'login',
    () => setScreen({ name: 'update', expired: false })
  )

  if (screen.name === 'update') {
    return (
      <UpdateScreen
        onDone={() => setScreen({ name: 'login', expired: screen.expired })}
      />
    )
  }
  if (screen.name === 'login') {
    return (
      <LoginScreen
        expired={screen.expired}
        onOpened={() => setScreen({ name: 'products' })}
      />
    )
  }
  return (
    <ProductScreen
      onExpired={() => setScreen(closedScreen(true))}
      onClosed={() => setScreen(closedScreen(false))}
    />
  )
}
