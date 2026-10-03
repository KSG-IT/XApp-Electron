import { useCallback, useEffect, useRef, useState } from 'react'

export const colors = {
  text: 'white',
  info: 'cyan',
  error: 'rgb(255, 59, 48)',
  lowBalance: 'rgb(255, 255, 0)',
}

export interface Message {
  text: string
  color: string
}

// A message that hides itself after `timeout` ms. A new message, or
// clearMessage(), replaces it at once.
export function useMessage() {
  const [message, setMessage] = useState<Message | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const clearMessage = useCallback(() => {
    window.clearTimeout(timer.current)
    setMessage(null)
  }, [])

  const showMessage = useCallback(
    (text: string, color = colors.info, timeout = 3000) => {
      window.clearTimeout(timer.current)
      setMessage({ text, color })
      timer.current = window.setTimeout(() => setMessage(null), timeout)
    },
    []
  )

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return { message, showMessage, clearMessage }
}
