import type { UserSettings } from '../../domain'
import type { SettingsDraftActions } from '../../hooks/use-settings-draft'
import { SwitchControl } from '../settings-controls'
import { readSettingsRowLabelId, SettingsRow } from '../settings-row'
import { SettingsSection } from '../settings-section'

interface RemindersSectionProps {
  actions: Pick<SettingsDraftActions, 'setRemindersEnabled' | 'setRemindersTime'>
  draft: UserSettings
}

export function RemindersSection({ actions, draft }: RemindersSectionProps) {
  const { enabled, time } = draft.reminders.daily
  const hasTimeError = enabled && time === ''

  return (
    <SettingsSection id="reminders-settings" title="Reminders">
      <SettingsRow
        controlClassName="w-full md:max-w-28"
        hint="Sends a local notification at the set time on days you have reviews due."
        id="reminders-enabled-row"
        label="Daily reminder"
        labelFor="reminders-enabled"
      >
        <SwitchControl
          ariaLabelledBy={readSettingsRowLabelId('reminders-enabled-row')}
          checked={enabled}
          id="reminders-enabled"
          onChange={actions.setRemindersEnabled}
        />
      </SettingsRow>
      <SettingsRow
        id="reminders-time-row"
        label="Reminder time"
        labelFor="reminders-time"
      >
        <div className="grid gap-1">
          <input
            aria-describedby={hasTimeError ? 'reminders-time-error' : undefined}
            aria-invalid={hasTimeError || undefined}
            className="h-[var(--cp-control-height)] rounded-[var(--cp-control-radius)] border border-border bg-background px-3 text-[length:var(--cp-control-font-size)] text-foreground shadow-sm transition-[background-color,border-color,box-shadow,opacity] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!enabled}
            id="reminders-time"
            onChange={(event) => actions.setRemindersTime(event.currentTarget.value)}
            type="time"
            value={time}
          />
          {hasTimeError ? (
            <span
              className="text-[length:var(--cp-copy-font-size)] font-semibold text-[color:var(--cp-tone-danger-fg)]"
              id="reminders-time-error"
              role="alert"
            >
              Enter a reminder time
            </span>
          ) : null}
        </div>
      </SettingsRow>
    </SettingsSection>
  )
}
