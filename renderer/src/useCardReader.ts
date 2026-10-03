import { useLayoutEffect, useRef } from 'react'

// The card reader is a keyboard: it types the card number, then Enter.
// useLayoutEffect (with flushSync in main.tsx) attaches the listener before
// the page fires `load`, so no key from a fast reader is lost.
export function useCardReader(onScan: (card: string) => void) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useLayoutEffect(() => {
    let buffer = ''
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
        const card = buffer
        buffer = ''
        if (card) onScanRef.current(card)
      } else if (event.key.length === 1) {
        buffer += event.key
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
