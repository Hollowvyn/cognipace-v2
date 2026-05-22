import { DashboardPlaceholderPage } from '@/app/dashboard/layout/dashboard-placeholder-page'
import { dashboardRouteMeta } from '@/app/dashboard/navigation/route-manifest'

export function OverviewPage() {
  return (
    <DashboardPlaceholderPage
      description='This will become the lightweight "what should I do now?" home for guided practice.'
      panelCopy="Phase 0 only establishes the app shell, route boundaries, and where the future overview modules will land."
      title={dashboardRouteMeta.overview.staticData.title}
    />
  )
}
