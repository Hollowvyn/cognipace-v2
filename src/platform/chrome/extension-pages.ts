import { browser } from 'wxt/browser'

export function getDashboardUrl() {
  return browser.runtime.getURL('/dashboard.html')
}
