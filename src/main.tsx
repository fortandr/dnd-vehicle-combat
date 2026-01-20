import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { avernusTheme } from './theme/avernusTheme'
import './styles/index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={avernusTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
