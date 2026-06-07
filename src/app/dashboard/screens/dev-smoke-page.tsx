import {
  DashboardPage,
  DashboardPageBody,
  DashboardPageHeader,
} from '@/app/dashboard/layout/dashboard-page'
import { useDashboardChrome } from '@/app/dashboard/dashboard-shell'
import { dashboardHiddenRouteMeta } from '@/app/dashboard/navigation/route-manifest'
import { DevSmokeScreen } from '@/features/dev-smoke'

export function DevSmokePage() {
  const { headerActions } = useDashboardChrome()

  return (
    <DashboardPage className="mx-auto w-full max-w-[64rem]">
      <DashboardPageHeader
        actions={headerActions}
        title={dashboardHiddenRouteMeta.devSmoke.staticData.title}
      >
        Dashboard runtime checks for extension development.
      </DashboardPageHeader>
      <DashboardPageBody>
        <DevSmokeScreen />
      </DashboardPageBody>
    </DashboardPage>
  )
}
