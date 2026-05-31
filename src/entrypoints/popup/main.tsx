import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@/app/styles.css'
import { PopupApp } from '@/app/popup/popup-app'
import { AppProviders } from '@/app/providers/app-providers'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders surface="popup">
      <PopupApp />
    </AppProviders>
  </StrictMode>,
)
