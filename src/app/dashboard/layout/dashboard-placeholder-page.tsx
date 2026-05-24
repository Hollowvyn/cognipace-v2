import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { dashboardPaths } from '@/app/dashboard/navigation/route-manifest'

import {
  DashboardPage,
  DashboardPageBody,
  DashboardPageHeader,
} from './dashboard-page'
import { PlaceholderPanel } from './placeholder-panel'

interface DashboardPlaceholderAction {
  label: string
  to: typeof dashboardPaths.trackNew
}

export interface DashboardPlaceholderPageProps {
  action?: DashboardPlaceholderAction | undefined
  description: string
  panelCopy: string
  title: string
}

export function DashboardPlaceholderPage({
  action,
  description,
  panelCopy,
  title,
}: DashboardPlaceholderPageProps) {
  return (
    <DashboardPage>
      <DashboardPageHeader title={title}>
        <p className="m-0">{description}</p>
      </DashboardPageHeader>
      <DashboardPageBody>
        <PlaceholderPanel
          action={
            action ? (
              <Button asChild variant="outline">
                <Link to={action.to}>{action.label}</Link>
              </Button>
            ) : undefined
          }
        >
          <p className="m-0">{panelCopy}</p>
        </PlaceholderPanel>
      </DashboardPageBody>
    </DashboardPage>
  )
}
