// src/app/dashboard/screens/analytics-page.tsx
import { AnalyticsScreen } from '@/features/analytics'
import { useSearch } from '@tanstack/react-router'
import type { AnalyticsRange } from '@/features/analytics/api/analytics-contracts'

import { useDashboardChrome } from '@/app/dashboard/dashboard-shell'
import {
  DashboardPage,
  DashboardPageBody,
  DashboardPageHeader,
} from '@/app/dashboard/layout/dashboard-page'
import { dashboardRouteMeta } from '@/app/dashboard/navigation/route-manifest'

export function AnalyticsPage() {
  const { headerActions } = useDashboardChrome()
  const { range } = useSearch({ from: '/analytics' }) as {
    range: AnalyticsRange
  }

  return (
    <DashboardPage className="mx-auto w-full max-w-[64rem]">
      <DashboardPageHeader
        actions={headerActions}
        title={dashboardRouteMeta.analytics.staticData.title}
      >
        Your local study health — reviews, retention, and upcoming workload.
      </DashboardPageHeader>
      <DashboardPageBody>
        <AnalyticsScreen range={range} />
      </DashboardPageBody>
    </DashboardPage>
  )
}
