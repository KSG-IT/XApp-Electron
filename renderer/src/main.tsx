import '@mantine/core/styles.css'
import './index.css'

import { MantineProvider } from '@mantine/core'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { App } from './App'
import { theme } from './theme'

const root = createRoot(document.getElementById('root')!)

// Render at once, so the card reader listener is attached before the page
// fires `load` (see useCardReader).
flushSync(() => {
  root.render(
    <MantineProvider theme={theme} forceColorScheme="dark">
      <App />
    </MantineProvider>
  )
})
