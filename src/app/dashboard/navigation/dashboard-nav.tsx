import { Link } from '@tanstack/react-router'

import { cn } from '@/utils/cn'
import {
  dashboardTopLevelRoutes,
  type DashboardTopLevelRoute,
} from './route-manifest'

const navLinkClassName = [
  'relative rounded-[var(--cp-radius-md)] px-3 py-2 text-sm font-semibold leading-none',
  'transition-[background-color,border-color,color,box-shadow] duration-[var(--cp-motion-duration-fast)] ease-[var(--cp-motion-ease)]',
  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
].join(' ')

export function DashboardNav({
  items = dashboardTopLevelRoutes,
}: {
  items?: readonly DashboardTopLevelRoute[]
}) {
  return (
    <nav
      aria-label="Dashboard"
      className="flex min-w-0 gap-2 overflow-x-auto lg:flex-col lg:overflow-visible"
    >
      {items.map((item) => (
        <Link
          activeProps={{
            className:
              'bg-muted text-foreground shadow-[inset_3px_0_0_var(--cp-color-primary)]',
          }}
          className={cn(navLinkClassName, 'shrink-0 text-muted-foreground')}
          inactiveProps={{ className: 'text-muted-foreground' }}
          key={item.path}
          to={item.path}
          {...(item.activeExact ? { activeOptions: { exact: true } } : {})}
        >
          {item.staticData.navLabel}
        </Link>
      ))}
    </nav>
  )
}
