# Global Theme Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings-backed global `system | light | dark` theme selector with an immediate click-to-cycle dashboard header button and a normal saved Settings form control.

**Architecture:** Theme preference belongs to the existing Settings feature as `appearance.themeMode`. The Settings domain/repository owns validation, patching, and cycling; UI receives the current mode and calls a runtime command without computing the next mode. Dashboard reads the setting directly through the Settings query, while popup and overlay receive appearance through the existing app-shell payloads and pass it into `SurfaceRoot`.

**Tech Stack:** WXT Chrome MV3, React 19, TypeScript, TanStack Query, Zod, Drizzle SQLite, Vitest, React Testing Library, Tailwind CSS tokens, lucide-react.

---

## File Structure

- Modify `src/features/settings/domain/settings.ts`: add `themeModeSchema`, `appearance` settings branch, patch support, and `deriveNextThemeMode`.
- Modify `src/features/settings/domain/index.ts`: export theme mode types/helpers.
- Modify `src/features/settings/domain/settings.test.ts`: cover default parsing, invalid appearance fallback, patch generation, and cycle order.
- Modify `src/features/settings/data/settings-repository.ts`: add `cycleThemeMode`.
- Modify `src/features/settings/data/settings-repository.test.ts`: verify cycle persists through the generic settings write path.
- Modify `src/features/settings/server/settings-service.ts`: expose `cycleThemeMode`.
- Modify `src/features/settings/api/settings-contracts.ts`: add cycle request type using the existing settings surface schema.
- Modify `src/features/settings/api/settings-api.ts`: add `useCycleThemeMode`.
- Modify `src/features/settings/api/settings-api.test.tsx`: verify runtime call and invalidation.
- Modify `src/extension/messaging.ts`: add `settings.cycleThemeMode` to protocol and re-export schema.
- Modify `src/extension/background/runtime-policy.ts`: authorize dashboard for `settings.cycleThemeMode`.
- Modify `src/extension/background/runtime-policy.test.ts`: verify dashboard-only cycle access and content-script rejection.
- Modify `src/extension/background/register-handlers.ts`: register cycle handler through the settings mutation path.
- Modify `src/extension/background/register-handlers.test.ts`: mock and verify cycle handler.
- Modify `src/features/app-shell/api/app-shell-contracts.ts`: include `appearance` in app-shell settings summaries.
- Modify `src/features/app-shell/server/app-shell-service.ts`: serialize `settings.appearance` for popup/dashboard and overlay.
- Modify `src/features/app-shell/server/app-shell-service.test.ts`: verify app-shell payloads include appearance.
- Modify `src/testing/app-shell-fixtures.ts`: add appearance to dashboard fixture.
- Modify `src/extension/background/register-handlers.test.ts`: add appearance to popup app-shell fixture after the app-shell schema changes.
- Modify `src/features/app-shell/hooks/use-popup-app-shell-controller.ts`: add fallback appearance.
- Modify `src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx`: add appearance to popup fixture.
- Modify `src/app/popup/popup-shell.tsx`: pass `data.settings.appearance.themeMode` to `SurfaceRoot`.
- Modify `src/app/popup/popup-shell.test.tsx`: assert popup root theme follows shell data.
- Modify `src/features/overlay-session/components/overlay-shell.tsx`: compute current overlay theme and pass it to mode components.
- Modify `src/features/overlay-session/components/modes/collapsed/collapsed-overlay.tsx`: accept `themeMode` prop.
- Modify `src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx`: accept `themeMode` prop.
- Modify `src/features/overlay-session/components/modes/docked/docked-overlay.tsx`: accept `themeMode` prop.
- Modify `src/features/overlay-session/components/overlay-shell.test.tsx`: verify theme mode is passed to the active overlay mode.
- Modify `src/app/dashboard/layout/dashboard-page.tsx`: support title-row actions.
- Create `src/app/dashboard/components/theme-mode-button.tsx`: current-mode icon button that calls a passed click handler.
- Modify `src/app/dashboard/dashboard-shell.tsx`: read settings, pass theme to `SurfaceRoot`, render title-row action state through child route context or a header-level control.
- Modify `src/app/dashboard/screens/*.tsx`: place header action in page headers if `DashboardShell` cannot centralize it without route duplication.
- Modify `src/app/dashboard/routes.test.tsx`: verify saved theme reaches dashboard root and header cycle calls runtime method.
- Modify `src/features/settings/hooks/use-settings-draft.ts`: add `setThemeMode` draft action.
- Modify `src/features/settings/hooks/use-settings-draft.test.tsx`: verify appearance save patch.
- Create `src/features/settings/components/sections/appearance-section.tsx`: Settings Appearance section with segmented control.
- Modify `src/features/settings/components/settings-screen.tsx`: render Appearance section.
- Modify `src/features/settings/components/settings-screen.test.tsx`: verify Appearance row and save behavior.
- Run focused tests and `npm run check`.

## Task 1: Settings Domain Theme Model

**Files:**

- Modify: `src/features/settings/domain/settings.ts`
- Modify: `src/features/settings/domain/index.ts`
- Test: `src/features/settings/domain/settings.test.ts`

- [ ] **Step 1: Write failing domain tests**

Add `deriveNextThemeMode` to the imports in `src/features/settings/domain/settings.test.ts`, then add these assertions:

```ts
import {
  createUserSettingsPatch,
  defaultUserSettings,
  deriveNextThemeMode,
  hasUserSettingsChanges,
  mergeUserSettings,
  parseStoredUserSettings,
  userSettingsSchema,
} from './settings'

it('defaults missing appearance settings to system without dropping valid stored values', () => {
  expect(
    parseStoredUserSettings({
      practice: {
        dailyGoal: 6,
        problemFilters: {
          skipPremium: true,
        },
      },
    }),
  ).toMatchObject({
    appearance: {
      themeMode: 'system',
    },
    practice: {
      dailyGoal: 6,
      mode: defaultUserSettings.practice.mode,
      problemFilters: {
        skipPremium: true,
      },
    },
  })
})

it('validates appearance mode at the domain boundary', () => {
  expect(userSettingsSchema.parse(defaultUserSettings).appearance).toEqual({
    themeMode: 'system',
  })
  expect(() =>
    userSettingsSchema.parse({
      ...defaultUserSettings,
      appearance: {
        themeMode: 'sepia',
      },
    }),
  ).toThrow()
})

it('uses default appearance for invalid stored appearance while preserving valid stored branches', () => {
  expect(
    parseStoredUserSettings({
      appearance: {
        themeMode: 'sepia',
      },
      practice: {
        dailyGoal: 6,
        problemFilters: {
          skipPremium: true,
        },
      },
    }),
  ).toMatchObject({
    appearance: {
      themeMode: 'system',
    },
    practice: {
      dailyGoal: 6,
      problemFilters: {
        skipPremium: true,
      },
    },
  })
})

it('patches appearance mode without dropping unrelated settings', () => {
  const draft = {
    ...defaultUserSettings,
    appearance: {
      themeMode: 'dark' as const,
    },
  }

  expect(createUserSettingsPatch(defaultUserSettings, draft)).toEqual({
    appearance: { themeMode: 'dark' },
  })
  expect(
    mergeUserSettings(defaultUserSettings, {
      appearance: { themeMode: 'light' },
    }),
  ).toEqual({
    ...defaultUserSettings,
    appearance: { themeMode: 'light' },
  })
})

it('derives the next theme mode in repository-owned cycle order', () => {
  expect(deriveNextThemeMode('system')).toBe('light')
  expect(deriveNextThemeMode('light')).toBe('dark')
  expect(deriveNextThemeMode('dark')).toBe('system')
})
```

- [ ] **Step 2: Run domain tests to verify failure**

Run:

```bash
npm run test -- src/features/settings/domain/settings.test.ts
```

Expected: fail because `appearance`, `themeMode`, and `deriveNextThemeMode` do not exist.

- [ ] **Step 3: Implement settings domain support**

In `src/features/settings/domain/settings.ts`, add the schema and type near the existing mode schemas:

```ts
export const themeModeSchema = z.enum(['system', 'light', 'dark'])
```

Add the settings branch before `practiceSettingsSchema`:

```ts
const appearanceSettingsSchema = z
  .object({
    themeMode: themeModeSchema.default('system'),
  })
  .strict()
```

Add `appearance` to `userSettingsSchema`:

```ts
export const userSettingsSchema = z
  .object({
    schemaVersion: z
      .literal(userSettingsSchemaVersion)
      .default(userSettingsSchemaVersion),
    appearance: appearanceSettingsSchema.default({ themeMode: 'system' }),
    practice: practiceSettingsSchema,
    review: reviewSettingsSchema,
    assessment: assessmentSettingsSchema,
    overlay: overlaySettingsSchema,
    reminders: remindersSettingsSchema,
  })
  .strict()
```

Add `appearance` to `userSettingsPatchSchema`:

```ts
export const userSettingsPatchSchema = z
  .object({
    appearance: appearanceSettingsSchema.partial().strict().optional(),
    practice: z
      .object({
        dailyGoal: practiceSettingsSchema.shape.dailyGoal.optional(),
        mode: studyModeSchema.optional(),
        problemFilters: practiceSettingsSchema.shape.problemFilters
          .partial()
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    review: reviewSettingsSchema.partial().optional(),
    assessment: z
      .object({
        requireSolveTime:
          assessmentSettingsSchema.shape.requireSolveTime.optional(),
        strictTiming: assessmentSettingsSchema.shape.strictTiming.optional(),
        timeTargetsMinutes: z
          .object(timeTargetsMinutesShape)
          .partial()
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    overlay: overlaySettingsSchema.partial().optional(),
    reminders: z
      .object({
        daily: remindersSettingsSchema.shape.daily
          .partial()
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
```

Export the new type:

```ts
export type ThemeMode = z.infer<typeof themeModeSchema>
```

Add the default branch:

```ts
export const defaultUserSettings: UserSettings = {
  schemaVersion: userSettingsSchemaVersion,
  appearance: {
    themeMode: 'system',
  },
  practice: {
    dailyGoal: 4,
    mode: 'studyPlan',
    problemFilters: {
      skipPremium: false,
    },
  },
  review: {
    targetRetention: 0.9,
    order: 'dueFirst',
  },
  assessment: {
    requireSolveTime: false,
    strictTiming: false,
    timeTargetsMinutes: {
      easy: 20,
      medium: 35,
      hard: 50,
    },
  },
  overlay: {
    autoDetectSolved: true,
  },
  reminders: {
    daily: {
      enabled: false,
      time: '09:00',
    },
  },
}
```

Add appearance to `createMergedUserSettings`:

```ts
appearance: {
  ...current.appearance,
  ...patch.appearance,
},
```

Update `parseStoredUserSettings` so a missing or invalid appearance branch does
not discard otherwise-valid stored settings:

```ts
export function parseStoredUserSettings(value: unknown): UserSettings {
  const appearanceSafeValue = createAppearanceSafeStoredValue(value)
  const parsed = userSettingsSchema.safeParse(appearanceSafeValue)

  if (parsed.success) {
    return parsed.data
  }

  const patch = userSettingsPatchSchema.safeParse(appearanceSafeValue)

  if (patch.success) {
    return mergeStoredUserSettingsPatch(patch.data) ?? defaultUserSettings
  }

  return defaultUserSettings
}
```

Add this helper below `parseStoredUserSettings`:

```ts
function createAppearanceSafeStoredValue(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  const appearance = appearanceSettingsSchema.safeParse(value.appearance)

  return {
    ...value,
    appearance: appearance.success
      ? appearance.data
      : defaultUserSettings.appearance,
  }
}
```

Add this helper near `hasObjectKeys`:

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
```

Add appearance to `createUserSettingsPatch` before practice:

```ts
const appearancePatch: NonNullable<UserSettingsPatch['appearance']> = {}
if (saved.appearance.themeMode !== draft.appearance.themeMode) {
  appearancePatch.themeMode = draft.appearance.themeMode
}
if (hasObjectKeys(appearancePatch)) {
  patch.appearance = appearancePatch
}
```

Add the cycle helper at the bottom:

```ts
export function deriveNextThemeMode(themeMode: ThemeMode): ThemeMode {
  switch (themeMode) {
    case 'system':
      return 'light'
    case 'light':
      return 'dark'
    case 'dark':
      return 'system'
  }
}
```

In `src/features/settings/domain/index.ts`, export the new schema/helper/type:

```ts
export {
  createUserSettingsPatch,
  dailyGoalSchema,
  defaultUserSettings,
  deriveNextThemeMode,
  hasUserSettingsChanges,
  mergeUserSettings,
  parseStoredUserSettings,
  reviewOrderSchema,
  studyModeSchema,
  themeModeSchema,
  timeOfDaySchema,
  timeTargetsMinutesSchema,
  timingTargetMinutesSchema,
  userSettingsPatchSchema,
  userSettingsSchema,
  userSettingsSchemaVersion,
  type ReviewOrder,
  type StudyMode,
  type ThemeMode,
  type UserSettings,
  type UserSettingsPatch,
} from './settings'
```

- [ ] **Step 4: Run domain tests to verify pass**

Run:

```bash
npm run test -- src/features/settings/domain/settings.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit domain changes**

```bash
git add src/features/settings/domain/settings.ts src/features/settings/domain/index.ts src/features/settings/domain/settings.test.ts
git commit -m "feat: add theme mode settings domain"
```

## Task 2: Settings Repository Cycle Operation

**Files:**

- Modify: `src/features/settings/data/settings-repository.ts`
- Test: `src/features/settings/data/settings-repository.test.ts`

- [ ] **Step 1: Write failing repository test**

Add this test to `src/features/settings/data/settings-repository.test.ts`:

```ts
it('cycles theme mode through the generic settings write path', async () => {
  const handle = await createTestDb({ seed: false })
  const repository = createSettingsRepository(handle.db)

  await repository.updateSettings({
    practice: { dailyGoal: 12 },
    appearance: { themeMode: 'system' },
  })

  await expect(repository.cycleThemeMode()).resolves.toEqual({
    ...defaultUserSettings,
    appearance: { themeMode: 'light' },
    practice: {
      ...defaultUserSettings.practice,
      dailyGoal: 12,
    },
  })
  await expect(repository.cycleThemeMode()).resolves.toMatchObject({
    appearance: { themeMode: 'dark' },
    practice: { dailyGoal: 12 },
  })
  await expect(repository.cycleThemeMode()).resolves.toMatchObject({
    appearance: { themeMode: 'system' },
    practice: { dailyGoal: 12 },
  })
})
```

- [ ] **Step 2: Run repository test to verify failure**

Run:

```bash
npm run test -- src/features/settings/data/settings-repository.test.ts
```

Expected: fail because `cycleThemeMode` does not exist.

- [ ] **Step 3: Implement repository cycle**

Modify imports in `src/features/settings/data/settings-repository.ts`:

```ts
import {
  defaultUserSettings,
  deriveNextThemeMode,
  mergeUserSettings,
  parseStoredUserSettings,
  type UserSettings,
  type UserSettingsPatch,
} from '../domain'
```

Add this method to `SettingsRepository` near `toggleStudyMode`:

```ts
async cycleThemeMode(now = new Date()) {
  return this.updateSettings(
    (currentSettings) => ({
      appearance: {
        themeMode: deriveNextThemeMode(currentSettings.appearance.themeMode),
      },
    }),
    now,
  )
}
```

- [ ] **Step 4: Run repository tests**

Run:

```bash
npm run test -- src/features/settings/data/settings-repository.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit repository changes**

```bash
git add src/features/settings/data/settings-repository.ts src/features/settings/data/settings-repository.test.ts
git commit -m "feat: cycle theme mode in settings repository"
```

## Task 3: Runtime And API Cycle Method

**Files:**

- Modify: `src/features/settings/server/settings-service.ts`
- Modify: `src/features/settings/api/settings-contracts.ts`
- Modify: `src/features/settings/api/settings-api.ts`
- Modify: `src/features/settings/api/settings-api.test.tsx`
- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/runtime-policy.test.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Write failing API hook test**

In `src/features/settings/api/settings-api.test.tsx`, import `useCycleThemeMode` and add this test:

```ts
import {
  settingsQueryKeys,
  useCycleThemeMode,
  useSettings,
  useToggleStudyMode,
  useUpdateSettings,
} from './settings-api'

it('sends theme-mode cycles and invalidates DB-backed settings state', async () => {
  vi.mocked(sendMessage).mockResolvedValue(null)
  const { queryClient, wrapper } = createQueryTestHarness()
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useCycleThemeMode(), {
    wrapper,
  })

  let response: unknown

  await act(async () => {
    response = await result.current.mutateAsync({
      surface: 'dashboard',
    })
  })

  expect(sendMessage).toHaveBeenCalledWith('settings.cycleThemeMode', {
    surface: 'dashboard',
  })
  expect(response).toBeNull()
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: queryKeys.settings.all,
  })
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: queryKeys.appShell.all,
  })
})
```

- [ ] **Step 2: Write failing runtime policy test**

In `src/extension/background/runtime-policy.test.ts`, extend the settings access tests:

```ts
it('allows dashboard senders to cycle theme mode', () => {
  expect(canCallExtensionMethod('settings.cycleThemeMode', 'dashboard')).toBe(
    true,
  )
  expect(canCallExtensionMethod('settings.cycleThemeMode', 'popup')).toBe(false)
  expect(
    canCallExtensionMethod('settings.cycleThemeMode', 'content-script'),
  ).toBe(false)
})
```

Also add `settings.cycleThemeMode` to the content-script rejection assertions:

```ts
expect(
  canCallExtensionMethod('settings.cycleThemeMode', 'content-script'),
).toBe(false)
```

- [ ] **Step 3: Write failing background handler test**

In `src/extension/background/register-handlers.test.ts`, add `cycleThemeMode` to `backgroundMocks`:

```ts
cycleThemeMode: vi.fn(),
```

Mock it from the settings service:

```ts
vi.mock('@/features/settings/server/settings-service', () => ({
  cycleThemeMode: backgroundMocks.cycleThemeMode,
  getSettings: backgroundMocks.getSettings,
  toggleStudyMode: backgroundMocks.toggleStudyMode,
  updateSettings: backgroundMocks.updateSettings,
}))
```

Initialize it in `beforeEach`:

```ts
backgroundMocks.cycleThemeMode.mockResolvedValue(defaultUserSettings)
```

Add to the settings write test after the toggle assertion:

```ts
vi.clearAllMocks()
const cycleResponse = await sendRuntimeMessage('settings.cycleThemeMode', {
  surface: 'dashboard',
})

expectRuntimePolicy('settings.cycleThemeMode', 'dashboard')
expect(backgroundMocks.cycleThemeMode).toHaveBeenCalledWith(backgroundMocks.db)
expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
  reason: 'settings-updated',
  source: 'dashboard',
  tags: ['settings'],
})
expectFlushBeforeBroadcast()
expect(cycleResponse).toBeNull()
```

- [ ] **Step 4: Run focused tests to verify failure**

Run:

```bash
npm run test -- src/features/settings/api/settings-api.test.tsx src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts
```

Expected: fail because cycle contracts, hooks, policy, and handler do not exist.

- [ ] **Step 5: Implement service, contracts, hook, protocol, policy, and handler**

In `src/features/settings/server/settings-service.ts`, add:

```ts
export function cycleThemeMode(db: Db) {
  return createSettingsRepository(db).cycleThemeMode()
}
```

In `src/features/settings/api/settings-contracts.ts`, add:

```ts
export const settingsCycleThemeModeRequestSchema = settingsRequestSchema

export type SettingsCycleThemeModeRequest = z.infer<
  typeof settingsCycleThemeModeRequestSchema
>
```

In `src/features/settings/api/settings-api.ts`, import the type and add:

```ts
import type {
  SettingsCycleThemeModeRequest,
  SettingsToggleStudyModeRequest,
  SettingsUpdateRequest,
} from './settings-contracts'

export function useCycleThemeMode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SettingsCycleThemeModeRequest) =>
      sendMessage('settings.cycleThemeMode', request),
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, ['settings'])
    },
  })
}
```

In `src/extension/messaging.ts`, export the schema and type:

```ts
export {
  settingsCycleThemeModeRequestSchema,
  settingsRequestSchema,
  settingsToggleStudyModeRequestSchema,
  settingsUpdateRequestSchema,
} from '@/features/settings/api/settings-contracts'
import {
  type SettingsCycleThemeModeRequest,
  type SettingsRequest,
  type SettingsToggleStudyModeRequest,
  type SettingsUpdateRequest,
} from '@/features/settings/api/settings-contracts'
```

Add the protocol method:

```ts
'settings.cycleThemeMode'(request: SettingsCycleThemeModeRequest): null
```

In `src/extension/background/runtime-policy.ts`, add:

```ts
'settings.cycleThemeMode': ['dashboard'],
```

In `src/extension/background/register-handlers.ts`, import schema/service:

```ts
settingsCycleThemeModeRequestSchema,
```

```ts
import {
  cycleThemeMode,
  getSettings,
  toggleStudyMode,
  updateSettings,
} from '@/features/settings/server/settings-service'
```

Register the handler near `settings.toggleStudyMode`:

```ts
onMessage('settings.cycleThemeMode', ({ data, sender }) => {
  const request = settingsCycleThemeModeRequestSchema.parse(data)

  assertCanSenderCallExtensionMethod(
    'settings.cycleThemeMode',
    request.surface,
    sender,
  )
  return runSettingsMutation(request.surface, (db) => cycleThemeMode(db)).then(
    () => null,
  )
})
```

- [ ] **Step 6: Run focused runtime/API tests**

Run:

```bash
npm run test -- src/features/settings/api/settings-api.test.tsx src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit runtime/API changes**

```bash
git add src/features/settings/server/settings-service.ts src/features/settings/api/settings-contracts.ts src/features/settings/api/settings-api.ts src/features/settings/api/settings-api.test.tsx src/extension/messaging.ts src/extension/background/runtime-policy.ts src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts
git commit -m "feat: add theme cycle runtime method"
```

## Task 4: App-Shell Appearance Payloads For Popup And Overlay

**Files:**

- Modify: `src/features/app-shell/api/app-shell-contracts.ts`
- Modify: `src/features/app-shell/server/app-shell-service.ts`
- Modify: `src/features/app-shell/server/app-shell-service.test.ts`
- Modify: `src/testing/app-shell-fixtures.ts`
- Modify: `src/extension/background/register-handlers.test.ts`
- Modify: `src/features/app-shell/hooks/use-popup-app-shell-controller.ts`
- Modify: `src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx`
- Modify: `src/app/popup/popup-shell.test.tsx`
- Modify: `src/app/popup/popup-shell.tsx`

- [ ] **Step 1: Write failing popup theme test**

In `src/app/popup/popup-shell.test.tsx`, add appearance to the `shellData.settings` fixture:

```ts
appearance: {
  themeMode: 'system',
},
```

Add this test:

```ts
it('applies the saved appearance theme to the popup surface', () => {
  render(
    <PopupShell
      controller={createController({
        data: {
          ...shellData,
          settings: {
            ...shellData.settings,
            appearance: {
              themeMode: 'dark',
            },
          },
        },
      })}
    />,
  )

  expect(screen.getByRole('main')).toHaveAttribute('data-cp-theme', 'dark')
})
```

- [ ] **Step 2: Write failing app-shell contract/server expectations**

In `src/testing/app-shell-fixtures.ts`, add appearance to `settings`:

```ts
settings: {
  appearance: {
    themeMode: 'system',
  },
  practice: {
    dailyGoal: 4,
    mode: 'studyPlan',
    problemFilters: {
      skipPremium: false,
    },
  },
  review: {
    targetRetention: 0.9,
    order: 'dueFirst',
  },
  assessment: {
    requireSolveTime: false,
    strictTiming: false,
    timeTargetsMinutes: {
      easy: 20,
      medium: 35,
      hard: 50,
    },
  },
},
```

In `src/features/app-shell/server/app-shell-service.test.ts`, add appearance
expectations to the popup and overlay payload tests:

```ts
expect(payload.settings.appearance).toEqual({
  themeMode: 'system',
})
```

Add this property as the first child of the populated overlay expectation:

```ts
appearance: {
  themeMode: 'system',
},
```

Add the same property as the first child of the empty overlay payload
expectation.

In `src/extension/background/register-handlers.test.ts`, update
`createPopupShellData().settings`:

```ts
settings: {
  appearance: defaultUserSettings.appearance,
  practice: defaultUserSettings.practice,
  review: defaultUserSettings.review,
  assessment: defaultUserSettings.assessment,
},
```

In `src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx`, add:

```ts
settings: {
  appearance: defaultUserSettings.appearance,
  practice: defaultUserSettings.practice,
  review: defaultUserSettings.review,
  assessment: defaultUserSettings.assessment,
},
```

- [ ] **Step 3: Run focused popup/app-shell tests to verify failure**

Run:

```bash
npm run test -- src/app/popup/popup-shell.test.tsx src/features/app-shell/server/app-shell-service.test.ts src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx src/extension/background/register-handlers.test.ts src/app/dashboard/routes.test.tsx
```

Expected: fail because app-shell settings summaries do not include appearance,
popup does not apply it, and app-shell fixtures do not include it yet.

- [ ] **Step 4: Implement app-shell appearance contracts and popup theme**

In `src/features/app-shell/api/app-shell-contracts.ts`, change the settings summary:

```ts
const appShellSettingsSummarySchema = z.object({
  appearance: userSettingsSchema.shape.appearance,
  practice: userSettingsSchema.shape.practice,
  review: userSettingsSchema.shape.review,
  assessment: appShellAssessmentSettingsSchema,
})
```

Add appearance to overlay payload schema:

```ts
overlay: z.object({
  appearance: userSettingsSchema.shape.appearance,
  automation: overlayAutomationSettingsSchema,
  problem: appShellProblemSummarySchema.nullable(),
  practice: practiceDetailsSchema.nullable(),
  timing: appShellAssessmentSettingsSchema,
  nextStep: overlayNextStepSchema.nullable(),
}),
```

In `src/features/app-shell/server/app-shell-service.ts`, add appearance to base data:

```ts
settings: {
  appearance: settings.appearance,
  practice: settings.practice,
  review: settings.review,
  assessment: settings.assessment,
},
```

Add appearance to each `getOverlayPayload` return object:

```ts
return {
  appearance: settings.appearance,
  automation: serializeOverlayAutomation(settings),
  problem: null,
  practice: null,
  timing: settings.assessment,
  nextStep: null,
}
```

For the populated overlay payload, return:

```ts
return {
  appearance: settings.appearance,
  automation: serializeOverlayAutomation(settings),
  problem: currentProblem,
  practice: serializePracticeDetails(practice),
  timing: settings.assessment,
  nextStep: serializeOverlayNextStep({
    activeTrackNextProblem,
    currentProblem,
    queueItems,
  }),
}
```

In `src/features/app-shell/hooks/use-popup-app-shell-controller.ts`, add fallback appearance:

```ts
settings: {
  appearance: {
    themeMode: 'system',
  },
  practice: {
    dailyGoal: 4,
    mode: 'studyPlan',
    problemFilters: {
      skipPremium: false,
    },
  },
  review: {
    targetRetention: 0.9,
    order: 'dueFirst',
  },
  assessment: {
    requireSolveTime: false,
    strictTiming: false,
    timeTargetsMinutes: {
      easy: 20,
      medium: 35,
      hard: 50,
    },
  },
},
```

In `src/app/popup/popup-shell.tsx`, pass the saved mode:

```tsx
<SurfaceRoot
  className="flex flex-col gap-[var(--cp-surface-gap)] p-[var(--cp-surface-padding)]"
  surface="popup"
  theme={data.settings.appearance.themeMode}
>
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test -- src/app/popup/popup-shell.test.tsx src/features/app-shell/server/app-shell-service.test.ts src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx src/extension/background/register-handlers.test.ts src/app/dashboard/routes.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit app-shell/popup changes**

```bash
git add src/features/app-shell/api/app-shell-contracts.ts src/features/app-shell/server/app-shell-service.ts src/features/app-shell/server/app-shell-service.test.ts src/testing/app-shell-fixtures.ts src/extension/background/register-handlers.test.ts src/features/app-shell/hooks/use-popup-app-shell-controller.ts src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx src/app/popup/popup-shell.tsx src/app/popup/popup-shell.test.tsx
git commit -m "feat: pass theme mode through app shell"
```

## Task 5: Overlay Theme Wiring

**Files:**

- Modify: `src/features/overlay-session/components/overlay-shell.tsx`
- Modify: `src/features/overlay-session/components/modes/collapsed/collapsed-overlay.tsx`
- Modify: `src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx`
- Modify: `src/features/overlay-session/components/modes/docked/docked-overlay.tsx`
- Modify: `src/features/overlay-session/components/overlay-shell.test.tsx`

- [ ] **Step 1: Write failing overlay shell test**

Replace the mode mocks in `src/features/overlay-session/components/overlay-shell.test.tsx` with props-aware mocks:

```ts
vi.mock('./modes/collapsed/collapsed-overlay', () => ({
  CollapsedOverlay: ({ themeMode }: { themeMode: string }) => (
    <div>Collapsed mode: {themeMode}</div>
  ),
}))

vi.mock('./modes/docked/docked-overlay', () => ({
  DockedOverlay: ({ themeMode }: { themeMode: string }) => (
    <div>Docked mode: {themeMode}</div>
  ),
}))

vi.mock('./modes/expanded/expanded-overlay', () => ({
  ExpandedOverlay: ({
    themeMode,
    view,
  }: {
    themeMode: string
    view: { problemTitle: string }
  }) => <div>Expanded mode: {view.problemTitle}: {themeMode}</div>,
}))
```

Update the existing route assertions:

```ts
it.each([
  ['collapsed', 'Collapsed mode: light'],
  ['expanded', 'Expanded mode: Two Sum: light'],
  ['docked', 'Docked mode: light'],
] as const)('routes to the %s mode', (visualMode, text) => {
  render(
    <OverlayShell
      {...createSession({
        context: {
          ...createSession().context!,
          appearance: {
            themeMode: 'light',
          },
        },
        overlay: {
          ...initialOverlaySessionState,
          visualMode,
        },
      })}
    />,
  )

  expect(screen.getByText(text)).toBeInTheDocument()
})
```

Add `appearance` to `createSession().context`:

```ts
appearance: {
  themeMode: 'system',
},
```

- [ ] **Step 2: Run overlay shell test to verify failure**

Run:

```bash
npm run test -- src/features/overlay-session/components/overlay-shell.test.tsx
```

Expected: fail because overlay mode components do not accept `themeMode`.

- [ ] **Step 3: Implement overlay theme props**

In `src/features/overlay-session/components/overlay-shell.tsx`, import the type:

```ts
import type { ThemeMode } from '@/features/settings'
```

Derive the current mode:

```ts
const themeMode: ThemeMode = context?.appearance.themeMode ?? 'system'
```

Pass it to each mode:

```tsx
return <DockedOverlay onRestore={actions.restore} themeMode={themeMode} />
```

```tsx
<ExpandedOverlay
  themeMode={themeMode}
  commands={
    {
      /* existing commands */
    }
  }
  view={
    {
      /* existing view */
    }
  }
/>
```

```tsx
<CollapsedOverlay
  themeMode={themeMode}
  commands={
    {
      /* existing commands */
    }
  }
  view={
    {
      /* existing view */
    }
  }
/>
```

In each mode component, add the prop and pass it to `SurfaceRoot`.

Collapsed:

```ts
import type { ThemeMode } from '@/features/settings'

type CollapsedOverlayProps = {
  commands: CollapsedOverlayCommands
  themeMode: ThemeMode
  view: CollapsedOverlayViewModel
}
```

```tsx
export function CollapsedOverlay({ commands, themeMode, view }: CollapsedOverlayProps) {
  // existing body
  return (
    <SurfaceRoot
      asChild
      data-cp-overlay-mode="collapsed"
      surface="overlay"
      theme={themeMode}
    >
```

Expanded:

```ts
import type { ThemeMode } from '@/features/settings'

type ExpandedOverlayProps = {
  commands: ExpandedOverlayCommands
  themeMode: ThemeMode
  view: ExpandedOverlayViewModel
}
```

```tsx
export function ExpandedOverlay({ commands, themeMode, view }: ExpandedOverlayProps) {
  return (
    <SurfaceRoot
      asChild
      data-cp-overlay-mode="expanded"
      surface="overlay"
      theme={themeMode}
    >
```

Docked:

```ts
import type { ThemeMode } from '@/features/settings'

type DockedOverlayProps = {
  onRestore: () => void
  themeMode: ThemeMode
}
```

```tsx
export function DockedOverlay({ onRestore, themeMode }: DockedOverlayProps) {
  return (
    <SurfaceRoot
      asChild
      data-cp-overlay-mode="docked"
      style={{ transform: `translateY(${drag.dockOffsetY}px)` }}
      surface="overlay"
      theme={themeMode}
    >
```

- [ ] **Step 4: Run overlay shell test**

Run:

```bash
npm run test -- src/features/overlay-session/components/overlay-shell.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit overlay changes**

```bash
git add src/features/overlay-session/components/overlay-shell.tsx src/features/overlay-session/components/modes/collapsed/collapsed-overlay.tsx src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx src/features/overlay-session/components/modes/docked/docked-overlay.tsx src/features/overlay-session/components/overlay-shell.test.tsx
git commit -m "feat: apply theme mode to overlay"
```

## Task 6: Dashboard Header Theme Cycle Button

**Files:**

- Modify: `src/app/dashboard/layout/dashboard-page.tsx`
- Create: `src/app/dashboard/components/theme-mode-button.tsx`
- Modify: `src/app/dashboard/dashboard-shell.tsx`
- Modify: dashboard screen files under `src/app/dashboard/screens/*.tsx` if the header action is passed through page headers.
- Modify: `src/app/dashboard/routes.test.tsx`

- [ ] **Step 1: Write failing dashboard route test**

In `src/app/dashboard/routes.test.tsx`, add this test:

```ts
it('applies the saved dashboard theme and cycles it from the header button', async () => {
  const darkSettings = {
    ...defaultUserSettings,
    appearance: {
      themeMode: 'dark' as const,
    },
  }
  vi.mocked(sendMessage).mockImplementation((method) => {
    if (method === 'settings.getSettings') {
      return Promise.resolve(darkSettings)
    }

    if (method === 'settings.cycleThemeMode') {
      return Promise.resolve(null)
    }

    if (method === 'app.getShellData') {
      return Promise.resolve(createDashboardAppShellData())
    }

    if (method === 'tracks.getWorkspace') {
      return Promise.resolve(createTrackWorkspaceResponse())
    }

    return Promise.resolve(defaultUserSettings)
  })

  const { user } = renderDashboard('/')

  await screen.findByRole('heading', { name: 'Overview' })
  const dashboardRoot = document.querySelector('[data-cp-surface="dashboard"]')
  expect(dashboardRoot).toHaveAttribute('data-cp-theme', 'dark')

  await user.click(screen.getByRole('button', { name: 'Cycle theme mode' }))

  expect(sendMessage).toHaveBeenCalledWith('settings.cycleThemeMode', {
    surface: 'dashboard',
  })
})
```

- [ ] **Step 2: Run dashboard route test to verify failure**

Run:

```bash
npm run test -- src/app/dashboard/routes.test.tsx
```

Expected: fail because `DashboardShell` does not read settings or render the cycle button.

- [ ] **Step 3: Add title-row action support**

Modify `src/app/dashboard/layout/dashboard-page.tsx`:

```tsx
export function DashboardPageHeader({
  actions,
  children,
  title,
}: {
  actions?: ReactNode
  children?: ReactNode
  title: string
}) {
  return (
    <header className="min-w-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
            {title}
          </h2>
          {children ? (
            <div className="mt-2 max-w-2xl text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
              {children}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Create current-mode button component**

Create `src/app/dashboard/components/theme-mode-button.tsx`:

```tsx
import { Monitor, Moon, Sun } from 'lucide-react'

import { IconButton } from '@/components/ui/icon-button'
import type { ThemeMode } from '@/features/settings'

interface ThemeModeButtonProps {
  isPending: boolean
  onCycleThemeMode: () => void
  themeMode: ThemeMode
}

export function ThemeModeButton({
  isPending,
  onCycleThemeMode,
  themeMode,
}: ThemeModeButtonProps) {
  const Icon = readThemeModeIcon(themeMode)

  return (
    <IconButton
      disabled={isPending}
      label="Cycle theme mode"
      onClick={onCycleThemeMode}
      tooltip={`Current theme: ${readThemeModeLabel(themeMode)}`}
      variant="ghost"
    >
      <Icon aria-hidden="true" />
    </IconButton>
  )
}

function readThemeModeIcon(themeMode: ThemeMode) {
  switch (themeMode) {
    case 'system':
      return Monitor
    case 'light':
      return Sun
    case 'dark':
      return Moon
  }
}

function readThemeModeLabel(themeMode: ThemeMode) {
  switch (themeMode) {
    case 'system':
      return 'System'
    case 'light':
      return 'Light'
    case 'dark':
      return 'Dark'
  }
}
```

- [ ] **Step 5: Wire dashboard shell settings and cycle command**

Have `DashboardShell` own the settings query and cycle mutation, then expose the
title-row action through dashboard chrome context. This keeps the fast action
centralized while still letting each page place it in its own title row.

In `src/app/dashboard/dashboard-shell.tsx`, import:

```tsx
import { Outlet } from '@tanstack/react-router'
import { createContext, useContext, useState, type ReactNode } from 'react'

import { ThemeModeButton } from './components/theme-mode-button'
import {
  useCycleThemeMode,
  useSettings,
  type ThemeMode,
} from '@/features/settings'
import { readErrorMessage } from '@/utils/errors'
```

Add context helpers:

```tsx
type DashboardChrome = {
  themeAction: ReactNode
  themeMode: ThemeMode
}

const DashboardChromeContext = createContext<DashboardChrome | null>(null)

export function useDashboardChrome() {
  const context = useContext(DashboardChromeContext)

  if (!context) {
    throw new Error('useDashboardChrome must be used inside DashboardShell.')
  }

  return context
}
```

Inside `DashboardShell`, read settings and cycle mutation:

```tsx
const settings = useSettings()
const cycleThemeMode = useCycleThemeMode()
const [themeStatus, setThemeStatus] = useState<string | null>(null)
const themeMode = settings.data?.appearance.themeMode ?? 'system'
const themeAction = (
  <>
    <ThemeModeButton
      isPending={cycleThemeMode.isPending}
      onCycleThemeMode={() => {
        setThemeStatus(null)
        void cycleThemeMode
          .mutateAsync({ surface: 'dashboard' })
          .catch((error) => {
            setThemeStatus(readErrorMessage(error, 'Failed to update theme.'))
          })
      }}
      themeMode={themeMode}
    />
    {themeStatus ? (
      <span className="sr-only" role="alert">
        {themeStatus}
      </span>
    ) : null}
  </>
)
```

Wrap the existing dashboard body in the provider and pass the theme:

```tsx
return (
  <DashboardChromeContext.Provider value={{ themeAction, themeMode }}>
    <SurfaceRoot asChild surface="dashboard" theme={themeMode}>
      <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
        {/* existing skip, aside, main, Outlet */}
      </div>
    </SurfaceRoot>
  </DashboardChromeContext.Provider>
)
```

In each page using `DashboardPageHeader`, call `useDashboardChrome()` and pass `actions={themeAction}`:

```tsx
const { themeAction } = useDashboardChrome()

<DashboardPageHeader
  actions={themeAction}
  title={dashboardRouteMeta.overview.staticData.title}
>
  What should I practice now?
</DashboardPageHeader>
```

Apply to:

- `src/app/dashboard/screens/overview-page.tsx`
- `src/app/dashboard/screens/tracks-page.tsx`
- `src/app/dashboard/screens/library-page.tsx`
- `src/app/dashboard/screens/analytics-page.tsx`
- `src/app/dashboard/screens/settings-page.tsx`
- `src/app/dashboard/layout/dashboard-placeholder-page.tsx`

- [ ] **Step 6: Run dashboard tests**

Run:

```bash
npm run test -- src/app/dashboard/routes.test.tsx
```

Expected: pass. If route tests produce duplicate "Cycle theme mode" buttons because parent and modal pages both render headers, scope the action only to top-level page headers and not modal headers.

- [ ] **Step 7: Commit dashboard theme cycle UI**

```bash
git add src/app/dashboard/layout/dashboard-page.tsx src/app/dashboard/components/theme-mode-button.tsx src/app/dashboard/dashboard-shell.tsx src/app/dashboard/screens/overview-page.tsx src/app/dashboard/screens/tracks-page.tsx src/app/dashboard/screens/library-page.tsx src/app/dashboard/screens/analytics-page.tsx src/app/dashboard/screens/settings-page.tsx src/app/dashboard/layout/dashboard-placeholder-page.tsx src/app/dashboard/routes.test.tsx
git commit -m "feat: add dashboard theme cycle button"
```

## Task 7: Settings Appearance Form Control

**Files:**

- Modify: `src/features/settings/hooks/use-settings-draft.ts`
- Modify: `src/features/settings/hooks/use-settings-draft.test.tsx`
- Create: `src/features/settings/components/sections/appearance-section.tsx`
- Modify: `src/features/settings/components/settings-screen.tsx`
- Modify: `src/features/settings/components/settings-screen.test.tsx`

- [ ] **Step 1: Write failing draft hook test**

Add to `src/features/settings/hooks/use-settings-draft.test.tsx`:

```ts
it('saves appearance theme changes through the settings draft workflow', async () => {
  const savedSettings = {
    ...defaultUserSettings,
    appearance: {
      themeMode: 'dark' as const,
    },
  }
  vi.mocked(sendMessage).mockImplementation((method) => {
    if (method === 'settings.getSettings') {
      return Promise.resolve(defaultUserSettings)
    }

    if (method === 'settings.updateSettings') {
      return Promise.resolve(savedSettings)
    }

    return Promise.reject(new Error(`Unexpected method ${method}`))
  })
  const { wrapper } = createQueryTestHarness()
  const { result } = renderHook(() => useSettingsDraft(), { wrapper })

  await waitFor(() => {
    expect(result.current.draft).toEqual(defaultUserSettings)
  })

  act(() => {
    result.current.actions.setThemeMode('dark')
  })

  expect(result.current.canSave).toBe(true)

  await act(async () => {
    await result.current.actions.save()
  })

  expect(sendMessage).toHaveBeenCalledWith('settings.updateSettings', {
    surface: 'dashboard',
    patch: {
      appearance: {
        themeMode: 'dark',
      },
    },
  })
})
```

- [ ] **Step 2: Write failing Settings screen test**

In `src/features/settings/components/settings-screen.test.tsx`, extend the grouped settings test:

```ts
expect(await screen.findByRole('heading', { name: 'Appearance' })).toBeVisible()
expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
expect(screen.getByRole('radio', { name: 'Light' })).toBeVisible()
expect(screen.getByRole('radio', { name: 'Dark' })).toBeVisible()
```

Add a save behavior test:

```ts
it('edits appearance and saves only after Save Settings', async () => {
  const user = userEvent.setup()
  const savedSettings = {
    ...defaultUserSettings,
    appearance: {
      themeMode: 'light' as const,
    },
  }
  vi.mocked(sendMessage).mockImplementation((method) => {
    if (method === 'settings.getSettings') {
      return Promise.resolve(defaultUserSettings)
    }

    if (method === 'settings.updateSettings') {
      return Promise.resolve(savedSettings)
    }

    return Promise.reject(new Error(`Unexpected method ${method}`))
  })
  const { wrapper } = createQueryTestHarness()

  render(<SettingsScreen />, { wrapper })

  await screen.findByRole('heading', { name: 'Appearance' })
  await user.click(screen.getByRole('radio', { name: 'Light' }))

  expect(screen.getByText('Unsaved changes')).toBeVisible()
  expect(sendMessage).not.toHaveBeenCalledWith(
    'settings.updateSettings',
    expect.anything(),
  )

  await user.click(screen.getByRole('button', { name: 'Save Settings' }))

  expect(sendMessage).toHaveBeenCalledWith('settings.updateSettings', {
    surface: 'dashboard',
    patch: {
      appearance: {
        themeMode: 'light',
      },
    },
  })
})
```

- [ ] **Step 3: Run settings hook/screen tests to verify failure**

Run:

```bash
npm run test -- src/features/settings/hooks/use-settings-draft.test.tsx src/features/settings/components/settings-screen.test.tsx
```

Expected: fail because draft actions and Appearance UI do not exist.

- [ ] **Step 4: Add settings draft action**

In `src/features/settings/hooks/use-settings-draft.ts`, import type:

```ts
type ThemeMode,
```

Add to `SettingsDraftActions`:

```ts
setThemeMode: (value: ThemeMode) => void
```

Add action type:

```ts
| { type: 'set-theme-mode'; value: ThemeMode }
```

Add action creator:

```ts
setThemeMode: (value) => {
  dispatch({ type: 'set-theme-mode', value })
},
```

Add reducer case:

```ts
case 'set-theme-mode':
  return updateDraft(state, (draft) => ({
    ...draft,
    appearance: {
      ...draft.appearance,
      themeMode: action.value,
    },
  }))
```

- [ ] **Step 5: Add Appearance section**

Create `src/features/settings/components/sections/appearance-section.tsx`:

```tsx
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
  const themeHint =
    'System follows your browser color scheme; light and dark force CogniPace surfaces.'

  return (
    <SettingsSection id="appearance-settings" title="Appearance">
      <SettingsRow
        controlClassName="w-full md:max-w-sm"
        hint={themeHint}
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
```

In `src/features/settings/components/settings-screen.tsx`, import and render before `DailyPracticeSection`:

```tsx
import { AppearanceSection } from './sections/appearance-section'
```

```tsx
<AppearanceSection actions={controller.actions} draft={controller.draft} />
```

- [ ] **Step 6: Run settings hook/screen tests**

Run:

```bash
npm run test -- src/features/settings/hooks/use-settings-draft.test.tsx src/features/settings/components/settings-screen.test.tsx
```

Expected: pass. If Testing Library reports duplicate radio names from hidden page content, scope assertions with `within(screen.getByRole('group', { name: 'Theme' }))`.

- [ ] **Step 7: Commit Settings Appearance UI**

```bash
git add src/features/settings/hooks/use-settings-draft.ts src/features/settings/hooks/use-settings-draft.test.tsx src/features/settings/components/sections/appearance-section.tsx src/features/settings/components/settings-screen.tsx src/features/settings/components/settings-screen.test.tsx
git commit -m "feat: add appearance settings control"
```

## Task 8: Final Verification And Docs Honesty

**Files:**

- Modify only if validation reveals a missing docs/testing note: `docs/product.md`, `docs/testing.md`, or `design.md`

- [ ] **Step 1: Run all focused tests from this plan**

Run:

```bash
npm run test -- src/features/settings/domain/settings.test.ts src/features/settings/data/settings-repository.test.ts src/features/settings/api/settings-api.test.tsx src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts src/app/popup/popup-shell.test.tsx src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx src/features/overlay-session/components/overlay-shell.test.tsx src/app/dashboard/routes.test.tsx src/features/settings/hooks/use-settings-draft.test.tsx src/features/settings/components/settings-screen.test.tsx
```

Expected: all listed test files pass.

- [ ] **Step 2: Run full project check**

Run:

```bash
npm run check
```

Expected: Drizzle check, WXT type generation, TypeScript, ESLint, and Vitest all pass.

- [ ] **Step 3: Run formatter check**

Run:

```bash
npm run format
```

Expected: Prettier reports all files formatted.

- [ ] **Step 4: If docs changed, validate docs formatting**

Only run this if product/testing/design docs were edited:

```bash
npx prettier --check docs/product.md docs/testing.md design.md
```

Expected: all touched Markdown files pass Prettier.

- [ ] **Step 5: Commit final fixes**

If Step 1-4 required fixes, run:

```bash
git status --short
```

Stage each changed source or test file shown by that command with an explicit
`git add path/to/file` command, then run:

```bash
git commit -m "fix: complete global theme selector validation"
```

If `git status --short` is clean after validation, do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan covers persisted settings, repository-owned cycling, dashboard immediate cycle, Settings dirty-state control, popup and overlay global application, error/pending behavior, and validation.
- Placeholder scan: No unfinished markers or unspecified test/fix steps remain.
- Type consistency: The plan consistently uses `ThemeMode`, `appearance.themeMode`, `deriveNextThemeMode`, and `settings.cycleThemeMode`.
