export {
  appShellQueryKeys,
  getDashboardAppShellDataViaRuntime,
  getOverlayAppShellDataViaRuntime,
  getPopupAppShellDataViaRuntime,
  useDashboardAppShellData,
  useOverlayAppShellData,
  usePopupAppShellData,
  type AppShellProblemSummary,
  type DashboardAppShellData,
  type OverlayNextStep,
  type OverlayAppShellData,
  type PopupAppShellData,
} from './api/app-shell-api'
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
