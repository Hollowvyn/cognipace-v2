import { Link } from '@tanstack/react-router'
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Map,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/utils/cn'
import {
  dashboardTopLevelRoutes,
  type DashboardSection,
  type DashboardTopLevelRoute,
} from './route-manifest'

const navLinkClassName = [
  'relative inline-flex h-9 items-center justify-center gap-2 rounded-[var(--cp-radius-md)] px-2.5 text-sm font-semibold leading-none',
  'lg:h-auto lg:justify-start lg:px-3 lg:py-2',
  'transition-[background-color,border-color,color,box-shadow] duration-[var(--cp-motion-duration-fast)] ease-[var(--cp-motion-ease)]',
  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
].join(' ')

const dashboardNavIcons: Record<DashboardSection, LucideIcon> = {
  analytics: BarChart3,
  library: BookOpen,
  overview: LayoutDashboard,
  settings: SettingsIcon,
  tracks: Map,
}

export function DashboardNav({
  items = dashboardTopLevelRoutes,
}: {
  items?: readonly DashboardTopLevelRoute[]
}) {
  return (
    <nav
      aria-label="Dashboard"
      className="flex min-w-0 justify-end gap-1 overflow-x-auto lg:flex-col lg:justify-start lg:gap-1.5 lg:overflow-visible"
    >
      {items.map((item) => {
        const Icon = dashboardNavIcons[item.staticData.section]

        return (
          <Link
            activeProps={{
              className:
                'bg-muted text-foreground shadow-[inset_0_-2px_0_var(--cp-color-primary)] lg:shadow-[inset_3px_0_0_var(--cp-color-primary)]',
            }}
            aria-label={item.staticData.navLabel}
            className={cn(navLinkClassName, 'shrink-0 text-muted-foreground')}
            inactiveProps={{ className: 'text-muted-foreground' }}
            key={item.path}
            title={item.staticData.navLabel}
            to={item.path}
            {...(item.activeExact ? { activeOptions: { exact: true } } : {})}
          >
            <Icon aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline lg:inline">
              {item.staticData.navLabel}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
