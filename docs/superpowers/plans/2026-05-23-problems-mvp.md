# Problems MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Problems/Library MVP end to end with a DB-backed, maintainable problem-management surface.

**Architecture:** `features/problems` owns Problems UI, API hooks, contracts, read models, and problem-specific primitives. `app/dashboard` only mounts route-level public surfaces. Writes persist first, flush, invalidate, and refetch from DB-backed queries; no optimistic Library row patching.

**Tech Stack:** React, TypeScript, TanStack Router, TanStack Query, TanStack Table, Zod, Drizzle SQLite, Vitest, Testing Library, WXT extension runtime.

---

## Working Rules

- Use TDD per checkpoint: failing test, minimal implementation, refactor, verification.
- Use subagents where available for scoped implementation/review work.
- Commit after each checkpoint when verification passes.
- Keep touched files small enough to reason about. Split files only when it reduces current complexity.
- Use TanStack Table headlessly for table state. Do not create a generic table framework.
- Keep Tracks read-only and hidden from the Problems MVP UI. No track writes.
- Include topics/companies as assignable and filterable metadata. Do not build standalone topic/company catalog management.
- Keep all mutation state DB-sourced: mutation success invalidates/refetches instead of patching Library rows.

## Checkpoint 1: Library Table Foundation

**Files:**
- Modify: `src/app/dashboard/screens/library-page.tsx`
- Modify: `src/features/problems/components/library/problem-library-screen.tsx`
- Modify: `src/features/problems/components/library/problem-library-table.tsx`
- Modify: `src/features/problems/components/library/problem-library-toolbar.tsx`
- Modify: `src/features/problems/components/library/problem-library-filtering.ts`
- Modify/Create: `src/features/problems/components/library/problem-library-columns.tsx`
- Modify/Create: `src/features/problems/components/library/use-problem-library-table.ts`
- Test: `src/features/problems/components/library/problem-library-screen.test.tsx`

- [ ] Write failing tests for the MVP table shell: visible columns are selection, Problem, Difficulty, Status, Retention, Last Review, Next Review; Tracks filter/details are not visible; one row expands at a time.
- [ ] Run the focused Library screen test and confirm the new expectations fail.
- [ ] Implement the TanStack table foundation with stable `problem.slug` row IDs, sorting, pagination, expansion, and selection state.
- [ ] Align the page shell with Settings: page header plus one quiet dense main surface.
- [ ] Remove visible Tracks controls/details from the MVP Library UI while preserving read-model data.
- [ ] Refactor only enough to keep table, columns, toolbar, and screen files focused.
- [ ] Run focused Library tests and TypeScript.
- [ ] Commit: `feat: build library table foundation`

## Checkpoint 2: Topics/Companies Read Surface

**Files:**
- Modify: `src/features/problems/components/library/problem-library-toolbar.tsx`
- Modify: `src/features/problems/components/library/problem-library-filtering.ts`
- Modify: `src/features/problems/components/library/problem-library-table.tsx`
- Test: `src/features/problems/components/library/problem-library-screen.test.tsx`

- [ ] Write failing tests for topic filter, company filter, clear filters, and expanded-row chip display.
- [ ] Run the focused Library screen test and confirm the new expectations fail.
- [ ] Wire topic/company filters to DB-backed Library options and TanStack column filters.
- [ ] Render topic/company chips in expanded details, using `None` when empty.
- [ ] Keep all filtering local to table state; do not add new runtime methods.
- [ ] Run focused Library tests and TypeScript.
- [ ] Commit: `feat: add library topic and company filters`

## Checkpoint 3: Create/Edit Modal Base

**Files:**
- Modify: `src/app/dashboard/screens/modal-placeholders.tsx`
- Create/Modify: `src/features/problems/components/form/problem-form-modal.tsx`
- Create/Modify: `src/features/problems/components/form/use-problem-form.ts`
- Create/Modify: `src/features/problems/components/form/problem-slug-input.ts`
- Test: `src/app/dashboard/routes.test.tsx`
- Test: `src/features/problems/components/form/problem-form-modal.test.tsx`

- [ ] Write failing tests for create route modal opening, create validation, create save/close, edit route loading, edit save/close, and cancel close.
- [ ] Run the focused route/form tests and confirm the new expectations fail.
- [ ] Replace only the problem modal placeholders with real problem modal pages; leave track placeholders alone.
- [ ] Implement fields for create: LeetCode URL or slug, title, difficulty, premium.
- [ ] Implement fields for edit: read-only slug, title, difficulty, premium.
- [ ] Normalize create slug from URL or raw slug and derive LeetCode URL from slug.
- [ ] Save through existing problem mutation hooks and navigate back to `/library`.
- [ ] Run focused route/form tests and TypeScript.
- [ ] Commit: `feat: add problem create and edit modals`

## Checkpoint 4: Topics/Companies Form Editing

**Files:**
- Modify: `src/features/problems/components/form/problem-form-modal.tsx`
- Create/Modify: `src/features/problems/components/form/problem-label-input.tsx`
- Modify: `src/features/problems/components/form/use-problem-form.ts`
- Test: `src/features/problems/components/form/problem-form-modal.test.tsx`

- [ ] Write failing tests for create/edit with existing labels, new labels, duplicate label normalization, empty arrays clearing labels, and failed-save input preservation.
- [ ] Run the focused form tests and confirm the new expectations fail.
- [ ] Add lightweight topic/company token inputs using existing edit response options.
- [ ] Submit topic/company label arrays as full replacements.
- [ ] Normalize whitespace and duplicate labels client-side before submit.
- [ ] Show save errors without clearing form state.
- [ ] Run focused form tests and TypeScript.
- [ ] Commit: `feat: add problem topic and company editing`

## Checkpoint 5: Row Actions

**Files:**
- Modify: `src/features/problems/components/library/problem-library-table.tsx`
- Create/Modify: `src/features/problems/components/library/problem-row-actions.tsx`
- Create/Modify: `src/features/problems/components/library/problem-confirmation-dialog.tsx`
- Modify: `src/features/practice/api/practice-api.ts`
- Test: `src/features/problems/components/library/problem-library-screen.test.tsx`
- Test: `src/features/practice/api/practice-api.test.tsx`

- [ ] Write failing tests for Open LeetCode, Edit, Suspend/Resume, Reset confirmation, Delete confirmation, protected delete hidden/unavailable, and backend delete refusal display.
- [ ] Run focused tests and confirm the new expectations fail.
- [ ] Add expanded-row actions: Open LeetCode, Edit, Suspend/Resume, Reset Schedule, Delete.
- [ ] Derive LeetCode URL from slug for links.
- [ ] Use Practice-owned mutations for suspend/resume/reset and invalidate Library-backed queries.
- [ ] Use confirmations for reset/delete. Reset calls `practice.resetSchedule` without `keepLog`.
- [ ] Show delete only for `isUserCreated`; keep backend refusal surfaced if returned.
- [ ] Run focused tests and TypeScript.
- [ ] Commit: `feat: add problem row actions`

## Checkpoint 6: Bulk Selection + Core Bulk Actions

**Files:**
- Modify: `src/features/problems/components/library/use-problem-library-table.ts`
- Modify: `src/features/problems/components/library/problem-library-columns.tsx`
- Modify: `src/features/problems/components/library/problem-library-table.tsx`
- Create/Modify: `src/features/problems/components/library/problem-bulk-action-bar.tsx`
- Test: `src/features/problems/components/library/problem-library-screen.test.tsx`

- [ ] Write failing tests for selecting one/many/all visible rows, clearing selection, bulk suspend/resume/reset/delete, protected delete skip reporting, and keyboard-reachable bulk bar.
- [ ] Run focused Library tests and confirm the new expectations fail.
- [ ] Add selection column and header select-all for visible/filtered rows.
- [ ] Show a bulk action bar only when rows are selected.
- [ ] Add bulk Suspend, Resume, Reset Schedule, and Delete.
- [ ] Confirm reset/delete and clear selection after successful bulk action.
- [ ] Report deleted/skipped counts for bulk delete.
- [ ] Run focused Library tests and TypeScript.
- [ ] Commit: `feat: add problem bulk actions`

## Checkpoint 7: Bulk Metadata Editing

**Files:**
- Modify: `src/features/problems/components/library/problem-bulk-action-bar.tsx`
- Create/Modify: `src/features/problems/components/library/problem-bulk-metadata-dialog.tsx`
- Reuse/Modify: `src/features/problems/components/form/problem-label-input.tsx`
- Test: `src/features/problems/components/library/problem-library-screen.test.tsx`

- [ ] Write failing tests for bulk difficulty, premium, topic replacement, company replacement, clearing labels with enabled empty arrays, disabled submit with no enabled fields, and success invalidation/refetch.
- [ ] Run focused Library tests and confirm the new expectations fail.
- [ ] Add Bulk Edit Metadata dialog for selected rows.
- [ ] Support difficulty, premium, topic labels, and company labels.
- [ ] Omitted fields stay unchanged; enabled empty topic/company arrays clear labels.
- [ ] Do not add bulk title, slug, URL, track, suspend, resume, or reset to this dialog.
- [ ] Run focused Library tests and TypeScript.
- [ ] Commit: `feat: add bulk problem metadata editing`

## Checkpoint 8: Final QA + Architecture Pass

**Files:**
- Modify any touched Problems files only when simplification or QA fixes are needed.
- Test: affected focused tests plus full suite.

- [ ] Audit touched files for LOC and complexity. Split or simplify only when it improves current maintainability.
- [ ] Confirm root feature barrels expose only public API/UI surfaces, not data/server internals.
- [ ] Align spacing, typography, focus states, buttons, surfaces, and table density with Settings.
- [ ] Run `npm run check`.
- [ ] If Vitest workers timeout locally, run `npm run test -- --maxWorkers=1`.
- [ ] Run WXT Chrome dashboard smoke for Library, filters, row expansion, create/edit, row actions, and bulk actions.
- [ ] Capture screenshots for main states and fix visible layout/a11y issues.
- [ ] Commit: `chore: polish problems mvp`

## Acceptance Criteria

- `/library` is a working all-problems surface with dense Settings-aligned table UI.
- Users can search/filter, inspect expanded details, create, edit, suspend/resume, reset, delete, bulk select, bulk core-action, and bulk metadata-edit problems.
- Topics and companies are filterable and editable as problem metadata.
- User-created problems can be hard deleted; seeded/captured problems are protected.
- Every write goes through runtime mutation, flush, invalidation, and refetch.
- Tracks are not editable or visible in Problems MVP.
- `npm run check` passes, or an explicit environment-related fallback is documented with `npm run test -- --maxWorkers=1` passing.
