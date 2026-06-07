# Notification Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Reminders section to the Settings page that lets users toggle daily review notifications and set the reminder time.

**Architecture:** Approach A — two new reducer actions in the existing `useSettingsDraft` hook, a new `RemindersSection` component that owns time-input validation locally, and wiring into `settings-screen.tsx`. The domain schema, patch diffing, background scheduler integration, and settings service are all already in place — no changes needed there.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Tailwind CSS, existing `SettingsSection` / `SettingsRow` / `SwitchControl` primitives.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/features/settings/hooks/use-settings-draft.ts` |
| Modify | `src/features/settings/hooks/use-settings-draft.test.tsx` |
| **Create** | `src/features/settings/components/sections/reminders-section.tsx` |
| **Create** | `src/features/settings/components/sections/reminders-section.test.tsx` |
| Modify | `src/features/settings/components/settings-screen.tsx` |
| Modify | `src/features/settings/components/settings-screen.test.tsx` |

---

## Task 1: Extend `useSettingsDraft` with reminder actions and time validation

**Files:**
- Modify: `src/features/settings/hooks/use-settings-draft.ts`
- Modify: `src/features/settings/hooks/use-settings-draft.test.tsx`

- [ ] **Step 1: Write three failing tests**

Append inside the existing `describe('useSettingsDraft', ...)` block in `use-settings-draft.test.tsx`:

```ts
it('sets reminders.daily.enabled via setRemindersEnabled', async () => {
  vi.mocked(sendMessage).mockResolvedValue(defaultUserSettings)
  const { wrapper } = createQueryTestHarness()
  const { result } = renderHook(() => useSettingsDraft(), { wrapper })

  await waitFor(() => {
    expect(result.current.draft).toEqual(defaultUserSettings)
  })

  act(() => {
    result.current.actions.setRemindersEnabled(true)
  })

  expect(result.current.draft?.reminders.daily.enabled).toBe(true)
  expect(result.current.hasChanges).toBe(true)
})

it('sets reminders.daily.time via setRemindersTime', async () => {
  vi.mocked(sendMessage).mockResolvedValue(defaultUserSettings)
  const { wrapper } = createQueryTestHarness()
  const { result } = renderHook(() => useSettingsDraft(), { wrapper })

  await waitFor(() => {
    expect(result.current.draft).toEqual(defaultUserSettings)
  })

  act(() => {
    result.current.actions.setRemindersTime('14:30')
  })

  expect(result.current.draft?.reminders.daily.time).toBe('14:30')
})

it('treats an empty reminder time as a validation error that blocks save', async () => {
  const currentSettings = {
    ...defaultUserSettings,
    reminders: { daily: { enabled: true, time: '09:00' } },
  }
  vi.mocked(sendMessage).mockResolvedValue(currentSettings)
  const { wrapper } = createQueryTestHarness()
  const { result } = renderHook(() => useSettingsDraft(), { wrapper })

  await waitFor(() => {
    expect(result.current.draft).toEqual(currentSettings)
  })

  act(() => {
    result.current.actions.setRemindersTime('')
  })

  expect(result.current.hasValidationErrors).toBe(true)
  expect(result.current.canSave).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/settings/hooks/use-settings-draft.test.tsx
```

Expected: 3 failures — `actions.setRemindersEnabled is not a function`, `actions.setRemindersTime is not a function`.

- [ ] **Step 3: Add the two action types to the reducer union**

In `use-settings-draft.ts`, find the `type SettingsDraftAction =` union and append two lines before the closing:

```ts
type SettingsDraftAction =
  | { type: 'discard' }
  | { type: 'loaded'; settings: UserSettings }
  | { type: 'number-input-changed'; field: SettingsNumberField; value: string }
  | { type: 'saved'; settings: UserSettings }
  | { type: 'set-ai-enabled'; value: boolean }
  | { type: 'set-ai-model'; value: string }
  | { type: 'set-ai-provider'; value: GenAiProviderId }
  | { type: 'set-auto-detect-solved'; value: boolean }
  | { type: 'set-reminders-enabled'; value: boolean }
  | { type: 'set-reminders-time'; value: string }
  | { type: 'set-require-solve-time'; value: boolean }
  | { type: 'set-review-order'; value: ReviewOrder }
  | { type: 'set-skip-premium'; value: boolean }
  | { type: 'set-status'; status: SettingsDraftStatus }
  | { type: 'set-study-mode'; value: StudyMode }
  | { type: 'set-strict-timing'; value: boolean }
  | { type: 'set-target-retention'; value: number }
  | { type: 'set-theme-mode'; value: ThemeMode }
```

- [ ] **Step 4: Add `setRemindersEnabled` and `setRemindersTime` to `SettingsDraftActions`**

In the `export interface SettingsDraftActions` block, add two entries (alphabetical order fits between `setReviewOrder` and `setSkipPremium`):

```ts
export interface SettingsDraftActions {
  discard: () => void
  resetDefaults: () => Promise<void>
  retry: () => void
  save: () => Promise<void>
  setAiEnabled: (value: boolean) => void
  setAiModel: (value: string) => void
  setAiProvider: (value: GenAiProviderId) => void
  setAutoDetectSolved: (value: boolean) => void
  setNumberInput: (field: SettingsNumberField, value: string) => void
  setRemindersEnabled: (value: boolean) => void
  setRemindersTime: (value: string) => void
  setRequireSolveTime: (value: boolean) => void
  setReviewOrder: (value: ReviewOrder) => void
  setSkipPremium: (value: boolean) => void
  setStudyMode: (value: StudyMode) => void
  setStrictTiming: (value: boolean) => void
  setTargetRetention: (value: number) => void
  setThemeMode: (value: ThemeMode) => void
}
```

- [ ] **Step 5: Add `hasTimeError` and update `hasValidationErrors`**

In `useSettingsDraft`, find these two lines:

```ts
const fieldErrors = createFieldErrors(state.numberInputs)
const hasValidationErrors = Object.values(fieldErrors).some(Boolean)
```

Replace with:

```ts
const fieldErrors = createFieldErrors(state.numberInputs)
const hasTimeError = Boolean(
  state.draft?.reminders.daily.enabled &&
  state.draft?.reminders.daily.time === ''
)
const hasValidationErrors = Object.values(fieldErrors).some(Boolean) || hasTimeError
```

- [ ] **Step 6: Add two reducer cases**

In `settingsDraftReducer`, add two cases before the `case 'set-require-solve-time':` case:

```ts
case 'set-reminders-enabled':
  return updateDraft(state, (draft) => ({
    ...draft,
    reminders: {
      ...draft.reminders,
      daily: { ...draft.reminders.daily, enabled: action.value },
    },
  }))
case 'set-reminders-time':
  return updateDraft(state, (draft) => ({
    ...draft,
    reminders: {
      ...draft.reminders,
      daily: { ...draft.reminders.daily, time: action.value },
    },
  }))
```

- [ ] **Step 7: Wire the two actions into the hook's `actions` return object**

In the `return { ... actions: { ... } }` block, add after `setReviewOrder`:

```ts
setRemindersEnabled: (value) =>
  dispatch({ type: 'set-reminders-enabled', value }),
setRemindersTime: (value) =>
  dispatch({ type: 'set-reminders-time', value }),
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npx vitest run src/features/settings/hooks/use-settings-draft.test.tsx
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/features/settings/hooks/use-settings-draft.ts \
        src/features/settings/hooks/use-settings-draft.test.tsx
git commit -m "feat: add setRemindersEnabled and setRemindersTime to useSettingsDraft"
```

---

## Task 2: Create `RemindersSection` component

**Files:**
- Create: `src/features/settings/components/sections/reminders-section.tsx`
- Create: `src/features/settings/components/sections/reminders-section.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/features/settings/components/sections/reminders-section.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  defaultUserSettings,
  type UserSettings,
} from '@/features/settings/domain'

import { RemindersSection } from './reminders-section'

function renderSection(
  overrides: Partial<UserSettings['reminders']['daily']> = {},
) {
  const draft: UserSettings = {
    ...defaultUserSettings,
    reminders: {
      daily: { ...defaultUserSettings.reminders.daily, ...overrides },
    },
  }
  const actions = {
    setRemindersEnabled: vi.fn(),
    setRemindersTime: vi.fn(),
  }
  return { actions, ...render(<RemindersSection actions={actions} draft={draft} />) }
}

describe('RemindersSection', () => {
  it('renders the Reminders section heading', () => {
    renderSection()
    expect(screen.getByRole('heading', { name: 'Reminders' })).toBeInTheDocument()
  })

  it('disables the time input when reminders are off', () => {
    renderSection({ enabled: false })
    expect(screen.getByLabelText('Reminder time')).toBeDisabled()
  })

  it('enables the time input when reminders are on', () => {
    renderSection({ enabled: true, time: '09:00' })
    expect(screen.getByLabelText('Reminder time')).not.toBeDisabled()
  })

  it('calls setRemindersEnabled(true) when the switch is clicked while off', async () => {
    const { actions } = renderSection({ enabled: false })
    const user = userEvent.setup()
    await user.click(screen.getByRole('switch', { name: 'Daily reminder' }))
    expect(actions.setRemindersEnabled).toHaveBeenCalledWith(true)
  })

  it('calls setRemindersTime when the time input changes', () => {
    const { actions } = renderSection({ enabled: true, time: '09:00' })
    fireEvent.change(screen.getByLabelText('Reminder time'), {
      target: { value: '14:30' },
    })
    expect(actions.setRemindersTime).toHaveBeenCalledWith('14:30')
  })

  it('shows an error and marks aria-invalid when enabled with an empty time', () => {
    renderSection({ enabled: true, time: '' })
    expect(screen.getByLabelText('Reminder time')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a reminder time')
  })

  it('hides the error when reminders are off even if time is empty', () => {
    renderSection({ enabled: false, time: '' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Reminder time')).not.toHaveAttribute('aria-invalid')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/settings/components/sections/reminders-section.test.tsx
```

Expected: all 7 tests fail — module not found.

- [ ] **Step 3: Create the component**

Create `src/features/settings/components/sections/reminders-section.tsx`:

```tsx
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/settings/components/sections/reminders-section.test.tsx
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/components/sections/reminders-section.tsx \
        src/features/settings/components/sections/reminders-section.test.tsx
git commit -m "feat: add RemindersSection component for notification preferences"
```

---

## Task 3: Wire `RemindersSection` into `settings-screen.tsx`

**Files:**
- Modify: `src/features/settings/components/settings-screen.tsx`
- Modify: `src/features/settings/components/settings-screen.test.tsx`

- [ ] **Step 1: Write a failing test**

In `settings-screen.test.tsx`, append inside the existing `describe('SettingsScreen', ...)` block:

```ts
it('renders the Reminders settings section', async () => {
  vi.mocked(sendMessage).mockResolvedValue(defaultUserSettings)
  const { wrapper } = createQueryTestHarness()
  render(<SettingsScreen />, { wrapper })
  expect(await screen.findByRole('heading', { name: 'Reminders' })).toBeVisible()
  expect(
    screen.getByRole('switch', { name: 'Daily reminder' }),
  ).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/settings/components/settings-screen.test.tsx
```

Expected: 1 failure — "Unable to find an accessible element with the role 'heading' and name 'Reminders'".

- [ ] **Step 3: Add import to `settings-screen.tsx`**

In `src/features/settings/components/settings-screen.tsx`, add to the import block:

```ts
import { RemindersSection } from './sections/reminders-section'
```

- [ ] **Step 4: Add `RemindersSection` JSX between `LeetCodeOverlaySection` and `AdvancedReviewSection`**

Replace this block in `settings-screen.tsx`:

```tsx
<LeetCodeOverlaySection
  actions={controller.actions}
  draft={controller.draft}
/>
<AdvancedReviewSection
```

With:

```tsx
<LeetCodeOverlaySection
  actions={controller.actions}
  draft={controller.draft}
/>
<RemindersSection
  actions={{
    setRemindersEnabled: controller.actions.setRemindersEnabled,
    setRemindersTime: controller.actions.setRemindersTime,
  }}
  draft={controller.draft}
/>
<AdvancedReviewSection
```

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: all tests pass, including the new Reminders screen test.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/components/settings-screen.tsx \
        src/features/settings/components/settings-screen.test.tsx
git commit -m "feat: wire RemindersSection into Settings page (#18)"
```
