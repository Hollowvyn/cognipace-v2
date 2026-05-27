import { DashboardSyncActions } from '@/features/sync'
import type { ThemeMode } from '@/features/settings'

import { ThemeModeButton } from './theme-mode-button'

interface DashboardHeaderActionsProps {
  isThemePending: boolean
  onCycleThemeMode: () => void
  themeMode: ThemeMode
}

export function DashboardHeaderActions({
  isThemePending,
  onCycleThemeMode,
  themeMode,
}: DashboardHeaderActionsProps) {
  return (
    <>
      <DashboardSyncActions />
      <ThemeModeButton
        isPending={isThemePending}
        onCycleThemeMode={onCycleThemeMode}
        themeMode={themeMode}
      />
    </>
  )
}
