import { createTheme } from '@mantine/core'

// The colors and font of ksg-nett-frontend (src/theme.ts there).
export const theme = createTheme({
  colors: {
    'samfundet-red': [
      '#ffedee',
      '#f4dbdb',
      '#e5b3b5',
      '#d88a8c',
      '#cd6769',
      '#b74c4e',
      '#A03033',
      '#892429',
      '#711b20',
      '#5a1217',
    ],
  },
  primaryColor: 'samfundet-red',
  fontFamily: 'Inter, "Open Sans", Helvetica, Arial, sans-serif',
})
