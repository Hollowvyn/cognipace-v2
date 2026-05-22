import { DashboardPlaceholderPage } from '@/app/dashboard/layout/dashboard-placeholder-page'
import { dashboardRouteMeta } from '@/app/dashboard/navigation/route-manifest'

export function AnalyticsPage() {
  return (
    <DashboardPlaceholderPage
      description="Queue, FSRS, and Analytics work will land separately from the Overview screen."
      panelCopy="This placeholder keeps Analytics route ownership clear while the scheduling and reporting work remains out of Phase 0."
      title={dashboardRouteMeta.analytics.staticData.title}
    />
  )
}
