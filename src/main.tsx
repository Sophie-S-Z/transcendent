import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { Backdrop } from './ui/Liquid'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Backdrop />
    <App />
  </StrictMode>,
)
