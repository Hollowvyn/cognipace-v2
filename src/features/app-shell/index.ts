export {
  appShellQueryKeys,
  getDashboardAppShellDataViaRuntime,
  getOverlayAppShellDataViaRuntime,
  getPopupAppShellDataViaRuntime,
  useDashboardAppShellData,
  useOverlayAppShellData,
  usePopupAppShellData,
  type AppShellPracticeProgress,
  type AppShellProblemSummary,
  type DashboardAppShellData,
  type DashboardOverviewData,
  type OverlayNextStep,
  type OverlayAppShellData,
  type PopupAppShellData,
} from './api/app-shell-api'
export {
  createDashboardOverviewView,
  type DashboardOverviewMetricView,
  type DashboardOverviewPrimaryView,
  type DashboardOverviewView,
} from './domain/dashboard-overview'
export { OverviewScreen } from './components/overview-screen'
export type {
  PopupAppShellView,
  PopupRecommendationView,
  PopupStudyModeView,
} from './domain/popup-app-shell'
export { createPopupAppShellView } from './domain/popup-app-shell'
export {
  usePopupAppShellController,
  type PopupAppShellActions,
  type PopupAppShellController,
  type PopupControllerStatus,
} from './hooks/use-popup-app-shell-controller'
