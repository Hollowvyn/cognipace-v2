import {
  DashboardPage,
  DashboardPageBody,
  DashboardPageHeader,
} from '@/app/dashboard/layout/dashboard-page'
import { dashboardRouteMeta } from '@/app/dashboard/navigation/route-manifest'
import { SettingsScreen } from '@/features/settings'

export function SettingsPage() {
  return (
    <DashboardPage className="mx-auto w-full max-w-[64rem]">
      <DashboardPageHeader title={dashboardRouteMeta.settings.staticData.title}>
        Configure practice, overlay, review, and timing.
      </DashboardPageHeader>
      <DashboardPageBody>
        <SettingsScreen />
      </DashboardPageBody>
    </DashboardPage>
  )
}
