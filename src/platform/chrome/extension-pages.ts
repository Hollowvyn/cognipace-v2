import { browser } from 'wxt/browser'

export type DashboardRoute = 'settings' | 'tracks'

export function getDashboardUrl(route?: DashboardRoute) {
  const url = browser.runtime.getURL('/dashboard.html')

  return route ? `${url}#/${route}` : url
}
