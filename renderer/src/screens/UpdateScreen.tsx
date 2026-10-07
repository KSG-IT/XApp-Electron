import { Center, Image, Loader, Stack, Text, Title } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import logo from '../../../assets/images/ksg-logo-white-on-black.png'

type Phase =
  | { name: 'checking' }
  | { name: 'updating'; tag: string }
  | { name: 'restarting'; tag: string }
  | { name: 'failed' }

const FAILED_DELAY_MS = 5000

interface UpdateScreenProps {
  // No update, or the update failed: show the login screen.
  onDone: () => void
}

// Before Soci opens, the till looks for a new release, installs it and starts
// it. This screen has no card reader, so nobody can open Soci during an update.
// A failed check (no internet) goes straight to the login screen.
export function UpdateScreen({ onDone }: UpdateScreenProps) {
  const [phase, setPhase] = useState<Phase>({ name: 'checking' })
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    let cancelled = false
    let failedTimer: number | undefined

    async function update() {
      const result = await window.xapp.checkForUpdate()
      if (cancelled) return
      if (result.status === 'none' || result.status === 'error') {
        onDoneRef.current()
        return
      }

      if (result.status === 'available') {
        setPhase({ name: 'updating', tag: result.tag })
        const installed = await window.xapp.installUpdate()
        if (cancelled) return
        if (!installed.ok) {
          setPhase({ name: 'failed' })
          failedTimer = window.setTimeout(
            () => onDoneRef.current(),
            FAILED_DELAY_MS
          )
          return
        }
      }

      setPhase({ name: 'restarting', tag: result.tag })
      // The app exits here. False means Soci is open, so go on as before.
      const restarted = await window.xapp.restartForUpdate()
      if (!restarted && !cancelled) onDoneRef.current()
    }

    update()
    return () => {
      cancelled = true
      window.clearTimeout(failedTimer)
    }
  }, [])

  return (
    <Center h="100vh">
      <Stack align="center" gap="md">
        <Image src={logo} alt="" w={150} h={150} radius={75} />
        <Title order={1} size="h3" fw={400}>
          X-App
        </Title>
        <UpdateStatus phase={phase} />
      </Stack>
    </Center>
  )
}

function UpdateStatus({ phase }: { phase: Phase }) {
  if (phase.name === 'failed') {
    return (
      <Text data-testid="update-status" c="pink.4">
        Oppdateringen feilet. Soci kan åpnes som vanlig.
      </Text>
    )
  }
  return (
    <>
      <Loader size="sm" />
      <Text data-testid="update-status">{statusText(phase)}</Text>
      {phase.name === 'updating' && (
        <Text size="sm" c="dimmed">
          Dette kan ta noen minutter. Ikke slå av maskinen.
        </Text>
      )}
    </>
  )
}

function statusText(phase: Exclude<Phase, { name: 'failed' }>) {
  if (phase.name === 'checking') return 'Ser etter oppdateringer …'
  if (phase.name === 'updating') return `Oppdaterer til ${phase.tag} …`
  return `Starter ${phase.tag} …`
}
