import { useState } from 'react'
import { LoginScreen } from './screens/LoginScreen'
import { ProductScreen } from './screens/ProductScreen'

type Screen = { name: 'login'; expired: boolean } | { name: 'products' }

export function App() {
  const [screen, setScreen] = useState<Screen>({
    name: 'login',
    expired: false,
  })

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
      onExpired={() => setScreen({ name: 'login', expired: true })}
      onClosed={() => setScreen({ name: 'login', expired: false })}
    />
  )
}
