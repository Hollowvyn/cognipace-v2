import { Monitor, Moon, Sun } from 'lucide-react'

import { IconButton } from '@/components/ui/icon-button'
import type { ThemeMode } from '@/features/settings'

interface ThemeModeButtonProps {
  isPending: boolean
  onCycleThemeMode: () => void
  themeMode: ThemeMode
}

const themeModeIcons = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} satisfies Record<ThemeMode, typeof Monitor>

const themeModeLabels = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
} satisfies Record<ThemeMode, string>

export function ThemeModeButton({
  isPending,
  onCycleThemeMode,
  themeMode,
}: ThemeModeButtonProps) {
  const ThemeIcon = themeModeIcons[themeMode]

  return (
    <IconButton
      disabled={isPending}
      label={`Cycle theme mode. Current theme: ${readThemeModeLabel(themeMode)}`}
      onClick={onCycleThemeMode}
      tooltip={`Current theme: ${readThemeModeLabel(themeMode)}`}
      variant="ghost"
    >
      <ThemeIcon aria-hidden="true" />
    </IconButton>
  )
}

function readThemeModeLabel(themeMode: ThemeMode) {
  return themeModeLabels[themeMode]
}
