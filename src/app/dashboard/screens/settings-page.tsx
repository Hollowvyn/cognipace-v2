import { DashboardPlaceholderPage } from '@/app/dashboard/layout/dashboard-placeholder-page'
import { dashboardRouteMeta } from '@/app/dashboard/navigation/route-manifest'

export function SettingsPage() {
  return (
    <DashboardPlaceholderPage
      description="MVP preferences will land here later."
      panelCopy="This route is reserved for preference controls only in the MVP shell."
      title={dashboardRouteMeta.settings.staticData.title}
    />
  )
}
