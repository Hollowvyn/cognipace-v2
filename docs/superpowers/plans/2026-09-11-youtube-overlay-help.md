# YouTube Overlay Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact Help shelf to the expanded LeetCode overlay whose icon opens a title-based YouTube search in a new tab and falls back to the problem slug.

**Architecture:** Keep the behavior inside `overlay-session`: a pure domain helper selects and encodes the search term, `OverlayShell` supplies current page data, and a focused expanded-mode component renders the native external link. The URL is derived at render time; no state, persistence, runtime message, background handler, or permission is added.

**Tech Stack:** React 19, TypeScript, Lucide React, shared CogniPace UI primitives, Vitest, React Testing Library, Tailwind CSS

---

## File Map

- Create `src/features/overlay-session/domain/help-search.ts`: select the best
  current search term and build the fixed YouTube results URL.
- Create `src/features/overlay-session/domain/help-search.test.ts`: cover title
  precedence, slug fallback, whitespace rejection, and exact URL encoding.
- Modify `src/features/overlay-session/domain/index.ts`: export the Help search
  functions and input type to the rest of the feature.
- Create
  `src/features/overlay-session/components/modes/expanded/overlay-help-section.tsx`:
  render the compact Help shelf and native icon link.
- Create
  `src/features/overlay-session/components/modes/expanded/overlay-help-section.test.tsx`:
  cover semantics, tooltip text, URL attributes, and the unavailable state.
- Modify
  `src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx`:
  accept the derived search term and place Help before Structured Log.
- Modify
  `src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx`:
  cover Help placement and supply the new view-model field.
- Modify `src/features/overlay-session/components/overlay-shell.tsx`: derive the
  search term from metadata title, stored title, and location slug.
- Modify `src/features/overlay-session/components/overlay-shell.test.tsx`: prove
  the shell passes the selected term only to expanded mode.
- Modify `docs/product.md`: record the new expanded-overlay Help behavior.
- Modify `docs/testing.md`: add the YouTube action to the live overlay smoke
  checklist.

### Task 1: Add The Pure Help Search Helper

**Files:**

- Create: `src/features/overlay-session/domain/help-search.test.ts`
- Create: `src/features/overlay-session/domain/help-search.ts`
- Modify: `src/features/overlay-session/domain/index.ts`

- [ ] **Step 1: Write the failing domain tests**

Create `src/features/overlay-session/domain/help-search.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  createYouTubeSearchUrl,
  selectOverlayHelpSearchQuery,
} from './help-search'

describe('overlay help search', () => {
  it('prefers captured metadata title over stored title and slug', () => {
    expect(
      selectOverlayHelpSearchQuery({
        metadataTitle: '33. Search in Rotated Sorted Array',
        problemTitle: 'Stored title',
        problemSlug: 'search-in-rotated-sorted-array',
      }),
    ).toBe('33. Search in Rotated Sorted Array')
  })

  it('uses stored title before falling back to the problem slug', () => {
    expect(
      selectOverlayHelpSearchQuery({
        metadataTitle: null,
        problemTitle: 'Search in Rotated Sorted Array',
        problemSlug: 'search-in-rotated-sorted-array',
      }),
    ).toBe('Search in Rotated Sorted Array')

    expect(
      selectOverlayHelpSearchQuery({
        metadataTitle: null,
        problemTitle: null,
        problemSlug: 'search-in-rotated-sorted-array',
      }),
    ).toBe('search-in-rotated-sorted-array')
  })

  it('ignores blank candidates and returns null without a usable query', () => {
    expect(
      selectOverlayHelpSearchQuery({
        metadataTitle: '  ',
        problemTitle: '',
        problemSlug: null,
      }),
    ).toBeNull()
  })

  it('builds an encoded YouTube results URL', () => {
    expect(createYouTubeSearchUrl(' 33. Search in Rotated Sorted Array ')).toBe(
      'https://www.youtube.com/results?search_query=33.+Search+in+Rotated+Sorted+Array',
    )
    expect(createYouTubeSearchUrl('  ')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the domain test and verify it fails**

Run:

```bash
npm test -- src/features/overlay-session/domain/help-search.test.ts --run
```

Expected: FAIL because `./help-search` does not exist.

- [ ] **Step 3: Implement the minimal pure helper**

Create `src/features/overlay-session/domain/help-search.ts`:

```ts
export type OverlayHelpSearchInput = {
  metadataTitle: string | null | undefined
  problemTitle: string | null | undefined
  problemSlug: string | null | undefined
}

const youtubeResultsUrl = 'https://www.youtube.com/results'

export function selectOverlayHelpSearchQuery({
  metadataTitle,
  problemTitle,
  problemSlug,
}: OverlayHelpSearchInput) {
  return firstNonBlank(metadataTitle, problemTitle, problemSlug)
}

export function createYouTubeSearchUrl(searchQuery: string) {
  const normalizedQuery = searchQuery.trim()

  if (!normalizedQuery) {
    return null
  }

  const url = new URL(youtubeResultsUrl)
  url.searchParams.set('search_query', normalizedQuery)
  return url.toString()
}

function firstNonBlank(
  ...candidates: ReadonlyArray<string | null | undefined>
) {
  for (const candidate of candidates) {
    const normalizedCandidate = candidate?.trim()

    if (normalizedCandidate) {
      return normalizedCandidate
    }
  }

  return null
}
```

Add this export to `src/features/overlay-session/domain/index.ts`:

```ts
export {
  createYouTubeSearchUrl,
  selectOverlayHelpSearchQuery,
  type OverlayHelpSearchInput,
} from './help-search'
```

- [ ] **Step 4: Run the domain test and verify it passes**

Run:

```bash
npm test -- src/features/overlay-session/domain/help-search.test.ts --run
```

Expected: PASS with four tests.

- [ ] **Step 5: Commit the helper**

```bash
git add src/features/overlay-session/domain/help-search.ts src/features/overlay-session/domain/help-search.test.ts src/features/overlay-session/domain/index.ts
git commit -m "feat(overlay): add YouTube help search helper"
```

### Task 2: Build The Compact Help Shelf

**Files:**

- Create:
  `src/features/overlay-session/components/modes/expanded/overlay-help-section.test.tsx`
- Create:
  `src/features/overlay-session/components/modes/expanded/overlay-help-section.tsx`

- [ ] **Step 1: Write the failing component tests**

Create
`src/features/overlay-session/components/modes/expanded/overlay-help-section.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { OverlayHelpSection } from './overlay-help-section'

describe('OverlayHelpSection', () => {
  it('renders an accessible YouTube search link in a new tab', async () => {
    const user = userEvent.setup()

    render(
      <OverlayHelpSection searchQuery="33. Search in Rotated Sorted Array" />,
    )

    expect(screen.getByRole('heading', { name: 'Help' })).toBeInTheDocument()

    const link = screen.getByRole('link', {
      name: 'Search YouTube for this problem',
    })

    expect(link).toHaveAttribute(
      'href',
      'https://www.youtube.com/results?search_query=33.+Search+in+Rotated+Sorted+Array',
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')

    await user.hover(link)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Search YouTube for this problem',
    )
  })

  it('renders a disabled icon when no search query is available', () => {
    render(<OverlayHelpSection searchQuery={null} />)

    expect(
      screen.getByRole('button', {
        name: 'Search YouTube for this problem',
      }),
    ).toBeDisabled()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```bash
npm test -- src/features/overlay-session/components/modes/expanded/overlay-help-section.test.tsx --run
```

Expected: FAIL because `./overlay-help-section` does not exist.

- [ ] **Step 3: Implement the Help shelf**

Create
`src/features/overlay-session/components/modes/expanded/overlay-help-section.tsx`:

```tsx
import { Youtube } from 'lucide-react'

import { IconButton } from '@/components/ui/icon-button'
import { createYouTubeSearchUrl } from '../../../domain'

const youtubeActionLabel = 'Search YouTube for this problem'

type OverlayHelpSectionProps = {
  searchQuery: string | null
}

export function OverlayHelpSection({ searchQuery }: OverlayHelpSectionProps) {
  const searchUrl = searchQuery ? createYouTubeSearchUrl(searchQuery) : null
  const icon = <Youtube aria-hidden="true" className="size-4" />
  const buttonClassName =
    'border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground disabled:bg-transparent'

  return (
    <section aria-labelledby="overlay-help-heading">
      <h2
        className="mb-2 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        id="overlay-help-heading"
      >
        Help
      </h2>

      <div className="flex min-h-10 items-center gap-2">
        {searchUrl ? (
          <IconButton
            asChild
            className={buttonClassName}
            label={youtubeActionLabel}
            tooltip={youtubeActionLabel}
            variant="ghost"
          >
            <a href={searchUrl} rel="noopener noreferrer" target="_blank">
              {icon}
            </a>
          </IconButton>
        ) : (
          <IconButton
            className={buttonClassName}
            disabled
            label={youtubeActionLabel}
            tooltip="Problem details are still loading"
            variant="ghost"
          >
            {icon}
          </IconButton>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run the component test and verify it passes**

Run:

```bash
npm test -- src/features/overlay-session/components/modes/expanded/overlay-help-section.test.tsx --run
```

Expected: PASS with two tests.

- [ ] **Step 5: Commit the Help shelf**

```bash
git add src/features/overlay-session/components/modes/expanded/overlay-help-section.tsx src/features/overlay-session/components/modes/expanded/overlay-help-section.test.tsx
git commit -m "feat(overlay): add compact Help shelf"
```

### Task 3: Wire Current Problem Data Into Expanded Mode

**Files:**

- Modify: `src/features/overlay-session/components/overlay-shell.test.tsx`
- Modify:
  `src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx`
- Modify: `src/features/overlay-session/components/overlay-shell.tsx`
- Modify:
  `src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx`

- [ ] **Step 1: Extend the shell mock and write the failing wiring test**

Change the `ExpandedOverlay` mock in
`src/features/overlay-session/components/overlay-shell.test.tsx` so its view
type and output expose the Help query:

```tsx
vi.mock('./modes/expanded/expanded-overlay', () => ({
  ExpandedOverlay: ({
    themeMode,
    view,
  }: {
    themeMode: string
    view: { helpSearchQuery: string | null; problemTitle: string }
  }) => (
    <div>
      Expanded mode: {view.problemTitle}: {themeMode}; Help query:{' '}
      {view.helpSearchQuery ?? 'unavailable'}
    </div>
  ),
}))
```

Update the existing expanded-mode expected text from:

```ts
'Expanded mode: Two Sum: light'
```

to:

```ts
'Expanded mode: Two Sum: light; Help query: Two Sum'
```

Add this focused shell test:

```tsx
it('falls back to the LeetCode slug for the expanded Help query', () => {
  const session = createSession()

  render(
    <OverlayShell
      {...createSession({
        context: {
          ...session.context!,
          problem: null,
        },
        location: {
          host: 'leetcode.com',
          slug: 'search-in-rotated-sorted-array',
          url: 'https://leetcode.com/problems/search-in-rotated-sorted-array/',
        },
        overlay: {
          ...initialOverlaySessionState,
          visualMode: 'expanded',
        },
      })}
    />,
  )

  expect(
    screen.getByText(
      'Expanded mode: search-in-rotated-sorted-array: system; Help query: search-in-rotated-sorted-array',
    ),
  ).toBeInTheDocument()
})
```

- [ ] **Step 2: Write the failing expanded placement test**

In
`src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx`,
add `helpSearchQuery: 'Two Sum'` to the default `view` returned by
`createProps`, then add:

```tsx
it('places the Help shelf before the structured log', () => {
  renderExpanded()

  const help = screen.getByRole('region', { name: 'Help' })
  const structuredLog = screen.getByRole('region', {
    name: 'Structured Log',
  })

  expect(
    help.compareDocumentPosition(structuredLog) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})
```

- [ ] **Step 3: Run both integration tests and verify they fail**

Run:

```bash
npm test -- src/features/overlay-session/components/overlay-shell.test.tsx src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx --run
```

Expected: FAIL because `ExpandedOverlay` does not accept or render
`helpSearchQuery`, and `OverlayShell` does not derive it.

- [ ] **Step 4: Derive the query in `OverlayShell`**

Add this feature-local import to
`src/features/overlay-session/components/overlay-shell.tsx`:

```ts
import { selectOverlayHelpSearchQuery } from '../domain'
```

Then derive the value near `problemTitle`:

```ts
const helpSearchQuery = selectOverlayHelpSearchQuery({
  metadataTitle: metadata?.title,
  problemTitle: context?.problem?.title,
  problemSlug: location?.slug,
})
```

Add the value to the expanded view model passed to `ExpandedOverlay`:

```tsx
view={{
  aiRecommendation,
  context,
  draft,
  elapsedSeconds: timer.elapsedSeconds,
  helpSearchQuery,
  isOverTarget: timer.isOverTarget,
  overlay,
  problemTitle,
  syncFeedback: feedback,
  syncStatus: status,
  targetSeconds: timer.targetSeconds,
  timerStatus: timer.status,
}}
```

- [ ] **Step 5: Render Help in `ExpandedOverlay`**

Import the new component in
`src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx`:

```ts
import { OverlayHelpSection } from './overlay-help-section'
```

Add the field to `ExpandedOverlayViewModel`:

```ts
helpSearchQuery: string | null
```

Destructure `helpSearchQuery` from `view`, then render the shelf immediately
before `OverlayLogFields`:

```tsx
<OverlayHelpSection searchQuery={helpSearchQuery} />

<OverlayLogFields
  disabled={isMutating || isSubmittedLocked}
  draft={overlay.draft}
  hasUnpersistedChanges={draft.hasUnpersistedChanges}
  onClearField={draft.clearField}
  onFieldChange={draft.setField}
/>
```

- [ ] **Step 6: Run the expanded overlay suite and verify it passes**

Run:

```bash
npm test -- src/features/overlay-session/domain/help-search.test.ts src/features/overlay-session/components/modes/expanded/overlay-help-section.test.tsx src/features/overlay-session/components/overlay-shell.test.tsx src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx --run
```

Expected: PASS for all four files, including the existing collapsed, expanded,
docked, timer, submission, and recommendation assertions in those files.

- [ ] **Step 7: Commit the expanded-overlay wiring**

```bash
git add src/features/overlay-session/components/overlay-shell.tsx src/features/overlay-session/components/overlay-shell.test.tsx src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx
git commit -m "feat(overlay): wire problem search into Help"
```

### Task 4: Keep Product And Smoke Documentation Current

**Files:**

- Modify: `docs/product.md`
- Modify: `docs/testing.md`

- [ ] **Step 1: Document the shipped overlay behavior**

In `docs/product.md`, add this bullet to the current LeetCode Overlay behavior
list after `settings access from the overlay`:

```markdown
- compact expanded-mode Help access that opens a YouTube search for the current
  problem in a new tab
```

- [ ] **Step 2: Extend the manual overlay smoke flow**

In `docs/testing.md`, add this step immediately after `Expand the overlay.` and
renumber the remaining steps:

```markdown
5. Focus the Help shelf's YouTube action, confirm its tooltip, activate it, and
   confirm a new tab opens with a search for the current problem title. Repeat
   during a title-unavailable page-load edge state and confirm the problem slug
   is used instead.
```

Extend the expected result with:

```markdown
The Help action remains keyboard accessible and opens the expected title- or
slug-based YouTube search without replacing the LeetCode tab.
```

- [ ] **Step 3: Check formatting for the two authority documents**

Run:

```bash
npx prettier --check docs/product.md docs/testing.md
```

Expected: PASS with both files formatted correctly.

- [ ] **Step 4: Commit the authority-doc updates**

```bash
git add docs/product.md docs/testing.md
git commit -m "docs(overlay): document YouTube Help action"
```

### Task 5: Validate The Complete Change

**Files:**

- Verify all implementation and documentation files from Tasks 1–4.
- Do not edit unrelated untracked files already present in the checkout.

- [ ] **Step 1: Run the complete focused overlay-session test set**

Run:

```bash
npm test -- src/features/overlay-session/domain/help-search.test.ts src/features/overlay-session/components/modes/expanded/overlay-help-section.test.tsx src/features/overlay-session/components/overlay-shell.test.tsx src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx --run
```

Expected: PASS with no overlay-session regressions.

- [ ] **Step 2: Run the repository validation gate**

Run:

```bash
npm run check
```

Expected: PASS for Drizzle checks, WXT preparation, TypeScript, ESLint, and the
full Vitest suite.

- [ ] **Step 3: Build the Chrome extension**

Run:

```bash
npm run build
```

Expected: PASS and a generated Chrome MV3 build under `.output/chrome-mv3`.

- [ ] **Step 4: Check repository formatting**

Run:

```bash
npm run format
```

Expected: PASS with no unformatted files.

- [ ] **Step 5: Prepare the required human smoke checklist and visual proof**

The human engineer must load `.output/chrome-mv3` in Chrome and record these
results before PR review or merge:

1. Open a LeetCode problem and confirm the overlay loads.
2. Exercise start, pause, and reset; expand the overlay.
3. Confirm `HELP` appears between the assessment content and Structured Log.
4. Tab to the YouTube icon and confirm the tooltip and visible focus treatment.
5. Activate the icon and confirm a new YouTube results tab opens for the full
   problem title while the LeetCode tab remains open.
6. During a title-unavailable page-load edge state, activate the action and
   confirm the slug is used as the search fallback.
7. Confirm collapse, dock, restore, submit/fail, and draft editing still work.
8. Attach a screenshot or screen recording showing the expanded Help shelf and
   the resulting YouTube search tab.

Expected: happy-path and edge-case smoke pass with visual proof attached. Do
not mark manual smoke testing or visual proof as N/A.

- [ ] **Step 6: Record the final validation handoff**

List every command run, every command skipped with its reason, the human smoke
result, the visual-proof location, and any remaining validation risk. Confirm
that the pre-existing untracked plan and pnpm files were not included in any
commit.
