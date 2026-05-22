import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@/app/styles.css'
import { DashboardApp } from '@/app/dashboard/navigation/routes'
import { AppProviders } from '@/app/providers/app-providers'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <DashboardApp />
    </AppProviders>
  </StrictMode>,
)
