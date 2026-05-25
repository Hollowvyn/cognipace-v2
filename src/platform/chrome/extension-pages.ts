import { browser } from 'wxt/browser'
import { z } from 'zod'

export const dashboardRouteSchema = z.enum(['settings', 'tracks'])

export type DashboardRoute = z.infer<typeof dashboardRouteSchema>

export function getDashboardUrl(route?: DashboardRoute) {
  const url = browser.runtime.getURL('/dashboard.html')

  return route ? `${url}#/${route}` : url
}
