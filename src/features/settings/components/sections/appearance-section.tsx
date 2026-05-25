import type { ThemeMode, UserSettings } from '../../domain'
import type { SettingsDraftActions } from '../../hooks/use-settings-draft'
import { SegmentedControl } from '../settings-controls'
import { readSettingsRowLabelId, SettingsRow } from '../settings-row'
import { SettingsSection } from '../settings-section'

const themeModeOptions: ReadonlyArray<{ label: string; value: ThemeMode }> = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]

interface AppearanceSectionProps {
  actions: Pick<SettingsDraftActions, 'setThemeMode'>
  draft: UserSettings
}

export function AppearanceSection({ actions, draft }: AppearanceSectionProps) {
  const themeModeHint =
    'System follows your browser color scheme; light and dark force CogniPace surfaces.'

  return (
    <SettingsSection id="appearance-settings" title="Appearance">
      <SettingsRow
        controlClassName="w-full md:max-w-md"
        hint={themeModeHint}
        id="theme-mode"
        label="Theme"
      >
        <SegmentedControl
          ariaLabelledBy={readSettingsRowLabelId('theme-mode')}
          label="Theme"
          name="theme-mode"
          onChange={actions.setThemeMode}
          options={themeModeOptions}
          value={draft.appearance.themeMode}
        />
      </SettingsRow>
    </SettingsSection>
  )
}
