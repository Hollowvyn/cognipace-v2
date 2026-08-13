# CogniPace Brand Overview Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the full CogniPace brand treatment open dashboard Overview from both the popup and dashboard surfaces.

**Architecture:** Keep navigation in each surface's existing owner. The popup controller opens the default dashboard tab through its current `getDashboardUrl` helper, while the dashboard sidebar uses a TanStack Router link to the existing `/` route. No new shared component, runtime message, route, permission, or persistence layer is needed.

**Tech Stack:** React 19, TypeScript, TanStack Router, WXT browser tabs API, Vitest, React Testing Library, Prettier, ESLint.

---

## File map

- Modify `src/features/app-shell/hooks/use-popup-app-shell-controller.ts` to expose the popup's `openOverview` action and allow the existing dashboard-tab helper to use its default route.
- Modify `src/app/popup/popup-shell.tsx` to make the popup brand a keyboard-accessible Overview button.
- Test `src/app/popup/popup-shell.test.tsx` for the visible popup brand control and action callback.
- Test `src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx` for opening the default dashboard URL.
- Modify `src/app/dashboard/dashboard-shell.tsx` to make the sidebar brand a Router link to the existing Overview path.
- Test `src/app/dashboard/routes.test.tsx` for navigation from a non-Overview dashboard route.
- Preserve the existing dependency-version edits in `package.json` and `package-lock.json`, and stage them unchanged with the final implementation commit as explicitly requested.

### Task 1: Add failing tests for both brand interactions

**Files:**

- Modify: `src/app/popup/popup-shell.test.tsx: around the "renders real popup data" test`
- Modify: `src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx: around the "opens dashboard and problem actions" test`
- Modify: `src/app/dashboard/routes.test.tsx: after the top-level navigation tests`

- [ ] **Step 1: Add the popup shell assertion.**

In the existing `renders real popup data and routes user actions through callbacks` test, click the brand before the other popup actions and assert the new controller callback:

```tsx
await user.click(screen.getByRole('button', { name: 'Open Overview' }))
await user.click(screen.getByRole('button', { name: 'Open Settings' }))
await user.click(screen.getByRole('button', { name: 'Open Tracks' }))

expect(controller.actions.openOverview).toHaveBeenCalledTimes(1)
expect(controller.actions.openSettings).toHaveBeenCalledTimes(1)
```

Leave the existing problem, shuffle, and study-mode clicks after these lines.

Add `openOverview: vi.fn()` to the `actions` object returned by `createController` at the bottom of the file.

- [ ] **Step 2: Add the popup controller URL assertion.**

In the existing `opens dashboard and problem actions` test, invoke the new action alongside the existing actions:

```tsx
act(() => {
  result.current.actions.openOverview()
  result.current.actions.openSettings()
  result.current.actions.openProblem(twoSum, 'recommendation')
})

expect(browserMocks.tabsCreate).toHaveBeenCalledWith({
  url: 'chrome-extension://extension-id/dashboard.html',
})
expect(browserMocks.tabsCreate).toHaveBeenCalledWith({
  url: 'chrome-extension://extension-id/dashboard.html#/settings',
})
```

Retain the existing LeetCode URL assertion. The new assertion should fail before the action exists, proving the popup behavior is covered.

- [ ] **Step 3: Add a dashboard route test.**

Add this test in `describe('dashboard routes')`:

```tsx
it('navigates to Overview when the dashboard brand is activated', async () => {
  const { router, user } = renderDashboard('/settings')

  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeVisible()

  await user.click(screen.getByRole('link', { name: 'Open Overview' }))

  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/')
  })
  expect(await screen.findByRole('heading', { name: 'Overview' })).toBeVisible()
})
```

- [ ] **Step 4: Run the focused tests and confirm they fail for the missing behavior.**

Run:

```sh
npm run test -- src/app/popup/popup-shell.test.tsx src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx src/app/dashboard/routes.test.tsx
```

Expected: FAIL because the popup controller lacks `openOverview`, the popup has no `Open Overview` button, and the dashboard has no `Open Overview` link. Existing unrelated tests may still pass.

### Task 2: Implement the popup brand navigation

**Files:**

- Modify: `src/features/app-shell/hooks/use-popup-app-shell-controller.ts: PopupAppShellActions, openDashboard, and returned actions`
- Modify: `src/app/popup/popup-shell.tsx: header brand markup`

- [ ] **Step 1: Extend the popup controller action contract.**

Add the action to `PopupAppShellActions`:

```ts
openOverview: () => void
```

Change the local helper signature from `async function openDashboard(route: DashboardRoute)` to `async function openDashboard(route?: DashboardRoute)`, preserving its existing `browser.tabs.create({ url: getDashboardUrl(route) })` behavior and error handling.

Return the new action before `openSettings`:

```ts
openOverview: () => {
  void openDashboard()
},
```

Keep `openSettings` and `openTracks` mapped to their current explicit route strings.

- [ ] **Step 2: Make the popup brand one semantic activation target.**

Replace the current popup brand `<div>` and `<h1>` with an `h1` containing a button so the title semantics remain while the mark and name share one target:

```tsx
<h1 className="m-0 min-w-0">
  <button
    aria-label="Open Overview"
    className="-m-1 flex min-w-0 items-center gap-2 rounded-[var(--cp-radius-md)] border-0 bg-transparent p-1 text-left text-[length:var(--cp-title-font-size)] font-extrabold leading-tight text-foreground transition-[background-color,color,box-shadow] duration-[var(--cp-motion-duration-fast)] ease-[var(--cp-motion-ease)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    onClick={actions.openOverview}
    type="button"
  >
    <span
      aria-hidden="true"
      className="grid size-7 shrink-0 place-items-center rounded-[var(--cp-radius-md)] bg-primary text-[0.8125rem] font-extrabold leading-none text-primary-foreground"
    >
      C
    </span>
    <span className="truncate">CogniPace</span>
  </button>
</h1>
```

Keep the existing Settings `IconButton` unchanged. The new focus ring and button reset ensure the control remains visually aligned and keyboard-visible without changing popup layout behavior.

### Task 3: Implement the dashboard brand navigation

**Files:**

- Modify: `src/app/dashboard/dashboard-shell.tsx: imports and sidebar brand markup`

- [ ] **Step 1: Import the existing dashboard path manifest and Router link.**

Add `Link` to the TanStack Router import and import `dashboardPaths` from the existing dashboard route manifest:

```tsx
import { Link } from '@tanstack/react-router'

import { dashboardPaths } from '@/app/dashboard/navigation/route-manifest'
```

- [ ] **Step 2: Wrap the existing dashboard brand in a link to Overview.**

Replace only the existing brand `<span>`/`<h1>` pair with:

```tsx
<h1 className="m-0 min-w-0">
  <Link
    aria-label="Open Overview"
    className="flex min-w-0 items-center gap-2 rounded-[var(--cp-radius-md)] text-[length:var(--cp-title-font-size)] font-extrabold leading-tight text-foreground transition-[background-color,color,box-shadow] duration-[var(--cp-motion-duration-fast)] ease-[var(--cp-motion-ease)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    to={dashboardPaths.overview}
  >
    <span
      aria-hidden="true"
      className="grid size-7 shrink-0 place-items-center rounded-[var(--cp-radius-md)] bg-primary text-[0.8125rem] font-extrabold leading-none text-primary-foreground"
    >
      C
    </span>
    <span className="hidden truncate min-[360px]:block">CogniPace</span>
  </Link>
</h1>
```

Keep the surrounding responsive layout and `DashboardNav` unchanged. The link uses the existing route manifest, so activating it from Overview, Settings, a modal route, or another page resolves to the same canonical Overview path.

### Task 4: Run focused verification and review the complete diff

**Files:**

- Verify: `src/app/popup/popup-shell.tsx`
- Verify: `src/features/app-shell/hooks/use-popup-app-shell-controller.ts`
- Verify: `src/app/dashboard/dashboard-shell.tsx`
- Verify: `src/app/popup/popup-shell.test.tsx`
- Verify: `src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx`
- Verify: `src/app/dashboard/routes.test.tsx`
- Include unchanged user edits: `package.json`, `package-lock.json`

- [ ] **Step 1: Run the focused popup and dashboard tests.**

Run:

```sh
npm run test -- src/app/popup/popup-shell.test.tsx src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx src/app/dashboard/routes.test.tsx
```

Expected: all tests in the three paths pass, including popup brand callback/URL assertions and dashboard Settings-to-Overview navigation.

- [ ] **Step 2: Run required surface validation.**

Run each command:

```sh
npm run lint
npm run check
npm run build
npm run format
git diff --check
```

Expected: lint, check, build, formatting, and whitespace validation all exit successfully. If a command fails because of the pre-existing dependency-version edits, record the exact failure and do not claim completion.

- [ ] **Step 3: Review the diff and stage only intended files plus approved version updates.**

Run:

```sh
git diff -- src/app/popup/popup-shell.tsx src/features/app-shell/hooks/use-popup-app-shell-controller.ts src/app/dashboard/dashboard-shell.tsx src/app/popup/popup-shell.test.tsx src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx src/app/dashboard/routes.test.tsx package.json package-lock.json
git status --short
```

Confirm the implementation changes contain only brand navigation/test coverage, and that `package.json`/`package-lock.json` contain the existing dependency-version updates without additional edits. Do not stage the unrelated untracked sync-timeout plan.

- [ ] **Step 4: Commit the implementation with the approved version updates.**

Run:

```sh
git add src/app/popup/popup-shell.tsx src/features/app-shell/hooks/use-popup-app-shell-controller.ts src/app/dashboard/dashboard-shell.tsx src/app/popup/popup-shell.test.tsx src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx src/app/dashboard/routes.test.tsx package.json package-lock.json
git commit -m "feat(navigation): make brand open overview"
```

### Task 5: Human smoke-test handoff

- [ ] **Step 1: Verify popup happy path and keyboard edge case.**

Load the built extension, click the CogniPace extension icon, click the brand mark/name, and confirm a dashboard tab opens at Overview. Reopen the popup, focus the brand with Tab, press Enter, and confirm the same result. Capture a screenshot or recording of the popup brand control and resulting Overview dashboard.

- [ ] **Step 2: Verify dashboard happy path and route edge cases.**

Open the dashboard, navigate to Settings, click the brand mark/name, and confirm the current tab navigates to Overview. Repeat from Tracks or Library, then focus the brand with keyboard navigation and press Enter. Confirm the Overview heading and content render each time. Capture screenshot or recording proof of the dashboard interaction and result.

- [ ] **Step 3: Record validation honestly in the handoff.**

List the exact automated commands run, any skipped commands with reasons, the popup and dashboard happy-path/edge-case smoke results, and the location of screenshot or recording proof. Note that no runtime contract, permission, database, migration, sync, or release workflow changed.
