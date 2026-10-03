import { Center, Image, Stack, Text, Title } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import logo from '../../../assets/images/ksg-logo-white-on-black.png'
import { useCardReader } from '../useCardReader'

export const EXPIRED_MESSAGE =
  'Økten er utløpt. Skann kortet for å åpne Soci igjen.'

interface LoginScreenProps {
  // The token expired on the product screen.
  expired: boolean
  onOpened: () => void
}

// "Scan your card to open Soci." Any active user's card can open Soci.
export function LoginScreen({ expired, onOpened }: LoginScreenProps) {
  const [output, setOutput] = useState(expired ? EXPIRED_MESSAGE : '')
  const clearTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(clearTimer.current), [])

  useCardReader(async card => {
    window.clearTimeout(clearTimer.current)
    clearTimer.current = window.setTimeout(() => setOutput(''), 3000)

    const response = await window.xapp.obtainToken(card)
    if (response.ok) {
      onOpened()
    } else if (response.status === 401) {
      setOutput('Sorry! Dette kortnummeret kan ikke brukes til å åpne Soci.')
    } else {
      console.log(response)
      setOutput(
        'Oisann, noe gikk galt! Vennligst sjekk om maskinen har internettilkobling.'
      )
    }
  })

  return (
    <Center h="100vh">
      <Stack align="center" gap="md">
        <Image src={logo} alt="" w={150} h={150} radius={75} />
        <Title order={1} size="h3" fw={400}>
          X-App
        </Title>
        <Text>Vennligst skann kortet ditt for å åpne Soci.</Text>
        <Text data-testid="login-output" c="pink.4" mih="1.5em">
          {output}
        </Text>
      </Stack>
    </Center>
  )
}
