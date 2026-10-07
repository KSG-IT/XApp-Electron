import { useEffect, useRef } from 'react'

// While Soci is closed and the login screen shows, look for a release in the
// background. A release moves the till to the update screen, which installs it.
export function useUpdatePolling(active: boolean, onFound: () => void) {
  const onFoundRef = useRef(onFound)
  onFoundRef.current = onFound

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const timer = window.setInterval(async () => {
      const result = await window.xapp.checkForUpdate()
      if (cancelled) return
      if (result.status === 'available' || result.status === 'installed') {
        onFoundRef.current()
      }
    }, window.xapp.updateConfig.intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [active])
}
