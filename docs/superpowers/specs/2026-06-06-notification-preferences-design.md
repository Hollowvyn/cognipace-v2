# Notification Preferences Settings — Design Spec

**Issue:** #18  
**Date:** 2026-06-06  
**Branch:** `o.olasoebikan/add-notification-preferences`

## Overview

Add a Reminders section to the Settings page that lets users enable/disable daily review reminders and set the local time for them. The Settings UI owns preferences only — the background scheduler (Issue #17) handles alarm creation and delivery. The component must not call `chrome.alarms` or `chrome.notifications` directly.

## What's Already Done

The following are already implemented and require no changes:

- `remindersSettingsSchema` in `settings.ts` — domain types, Zod validation, patch diffing, merge logic, and defaults (`enabled: false, time: '09:00'`)
- `due-notification.ts` — `onSettingsChanged` reschedules/clears the alarm when settings change
- `register-handlers.ts` — wires `onSettingsChanged` into the `settings.updateSettings` message handler

## What This Spec Covers

1. Two new actions in `use-settings-draft`
2. A new `RemindersSection` component
3. Wiring it into `settings-screen.tsx`

---

## Architecture

### 1. Hook — `use-settings-draft.ts`

**New action types** added to the reducer union:

```ts
{ type: 'set-reminders-enabled'; value: boolean }
{ type: 'set-reminders-time'; value: string }
```

**New reducer cases** — both use the existing `updateDraft` helper, matching the pattern of every other settings field:

- `set-reminders-enabled` → updates `draft.reminders.daily.enabled`
- `set-reminders-time` → updates `draft.reminders.daily.time`

**New derived value** added before `canSave`:

```ts
const hasTimeError = Boolean(
  state.draft?.reminders.daily.enabled &&
  state.draft?.reminders.daily.time === ''
)
```

`hasTimeError` is OR'd into the existing `hasValidationErrors` computation:

```ts
const hasValidationErrors = Object.values(fieldErrors).some(Boolean) || hasTimeError
```

This ensures the form's `focusFirstInvalidField` correctly focuses the invalid time input on submit attempt, and `canSave` is blocked while the time is empty.

**New entries on `SettingsDraftActions`:**

```ts
setRemindersEnabled: (value: boolean) => void
setRemindersTime: (value: string) => void
```

### 2. Component — `RemindersSection`

**File:** `src/features/settings/components/sections/reminders-section.tsx`

**Props:**

```ts
interface RemindersSectionProps {
  actions: Pick<SettingsDraftActions, 'setRemindersEnabled' | 'setRemindersTime'>
  draft: UserSettings
}
```

**Structure:**

```
SettingsSection id="reminders-settings" title="Reminders"

  SettingsRow
    label="Daily reminder"
    hint="Sends a local notification at the set time on days you have reviews due."
    SwitchControl
      checked={draft.reminders.daily.enabled}
      onChange={actions.setRemindersEnabled}

  SettingsRow
    label="Reminder time"
    labelFor="reminders-time"
    <input type="time">
      id="reminders-time"
      value={draft.reminders.daily.time}
      disabled={!draft.reminders.daily.enabled}
      aria-invalid={enabled && time === ""}
      onChange → actions.setRemindersTime(event.currentTarget.value)
    [inline error text when enabled && time === "": "Enter a reminder time"]
```

**Time input approach — Option C:**
- Native `<input type="time">` for browser picker UX (format errors are impossible)
- The only invalid value is `""` (user cleared the field)
- `aria-invalid` is set when `enabled && time === ""`
- Inline error rendered below the label in the same row (not a tooltip) when invalid
- Time row is disabled when reminders are off

**Error handling:** Since `<input type="time">` only emits valid `HH:mm` or `""`, the error message is always "Enter a reminder time" — no format variant needed.

### 3. Settings Screen — `settings-screen.tsx`

`RemindersSection` is inserted between `LeetCodeOverlaySection` and `AdvancedReviewSection`. This placement is thematically adjacent to daily practice settings and before the advanced tuning options.

```tsx
<RemindersSection
  actions={{
    setRemindersEnabled: controller.actions.setRemindersEnabled,
    setRemindersTime: controller.actions.setRemindersTime,
  }}
  draft={controller.draft}
/>
```

No changes needed to `SettingsSaveDock`, `SettingsToast`, or any other screen component.

---

## Data Flow

```
User toggles switch / changes time
  → actions.setRemindersEnabled / setRemindersTime
  → reducer updates draft.reminders.daily
  → hasTimeError derived from draft
  → hasValidationErrors blocks save if time is empty while enabled
  → user saves → createUserSettingsPatch → updateSettings message
  → register-handlers.ts → dueNotification.onSettingsChanged
  → background scheduler reschedules or clears alarm
```

---

## Acceptance Criteria

- Settings page displays a Reminders section with enable/disable toggle and time input
- Time input is disabled when reminders are off
- Clearing the time field shows an inline error and blocks save
- Valid time changes persist across reloads via `settings.updateSettings`
- Background scheduler receives update signals via the existing `onSettingsChanged` path
- Component does not call `chrome.alarms` or `chrome.notifications`

## Out of Scope

Per Issue #18: no notification history, multiple reminder times, snooze, quiet hours, or permission education flows.
