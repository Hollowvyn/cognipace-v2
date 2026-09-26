import { useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

import { normalizeTopicSearchKey } from '../../domain/topic-taxonomy'
import type { ProblemLibraryOptions } from '../../api/problems-contracts'
import type { ProblemLibraryFilters } from './problem-library-filtering'

export function ProblemLibraryTopicFilter({
  options,
  filters,
  onChange,
}: {
  options: ProblemLibraryOptions['topics']
  filters: ProblemLibraryFilters
  onChange: (patch: Partial<ProblemLibraryFilters>) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const panelId = useId()
  const searchId = useId()
  const key = normalizeTopicSearchKey(filters.topicQuery)
  const visible = options.filter((option) =>
    [option.label, ...option.aliases].some((label) =>
      normalizeTopicSearchKey(label).includes(key),
    ),
  )
  const selectedNames = options
    .filter((option) => filters.topicIds.includes(option.id))
    .map((option) => option.label)
  const summary =
    selectedNames.length === 0
      ? 'All topics'
      : selectedNames.length === 1
        ? selectedNames[0]
        : `${selectedNames.length} selected`

  useEffect(() => {
    if (!open) return
    search.current?.focus()

    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    }

    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const toggle = (id: string) =>
    onChange({
      topicIds: filters.topicIds.includes(id)
        ? filters.topicIds.filter((selected) => selected !== id)
        : [...filters.topicIds, id],
    })

  return (
    <div ref={root} className="relative min-w-0 pt-2">
      <span className="absolute left-3 top-0 z-10 max-w-[calc(100%-1.5rem)] truncate bg-card px-1 text-[length:var(--cp-badge-font-size)] font-semibold leading-none text-muted-foreground">
        Topics
      </span>
      <button
        type="button"
        ref={trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="min-h-[var(--cp-control-height-lg)] w-full rounded-[var(--cp-control-radius)] border border-border bg-card px-3 text-left text-[length:var(--cp-control-font-size)] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Topics: {summary}
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-full z-30 grid max-h-96 w-full min-w-56 gap-3 overflow-y-auto rounded-[var(--cp-control-radius)] border border-border bg-popover p-3 text-popover-foreground shadow-md"
        >
          <label
            htmlFor={searchId}
            className="grid gap-1 text-[length:var(--cp-control-font-size)] font-medium"
          >
            Search topics
            <input
              id={searchId}
              ref={search}
              type="search"
              autoComplete="off"
              value={filters.topicQuery}
              onChange={(event) => onChange({ topicQuery: event.target.value })}
              className="min-h-[var(--cp-control-height)] w-full rounded-[var(--cp-control-radius)] border border-border bg-card px-2 text-[length:var(--cp-control-font-size)] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </label>
          <Button
            type="button"
            className="justify-start px-2"
            onClick={() => onChange({ topicIds: [] })}
            size="sm"
            variant="ghost"
          >
            All topics
          </Button>
          <fieldset className="grid gap-1">
            <legend className="sr-only">Topic choices</legend>
            {visible.map((option) => (
              <label
                key={option.id}
                className="flex min-h-9 items-center gap-2 rounded px-2 text-sm hover:bg-accent/50"
              >
                <input
                  type="checkbox"
                  value={option.id}
                  checked={filters.topicIds.includes(option.id)}
                  onChange={() => toggle(option.id)}
                />
                {option.label}
              </label>
            ))}
            {visible.length === 0 && (
              <p role="status" className="px-2 text-sm text-muted-foreground">
                No topics match this search.
              </p>
            )}
          </fieldset>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Topic matching
          <select
            className="min-h-[var(--cp-control-height)] rounded-[var(--cp-control-radius)] border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            value={filters.topicMatchMode}
            onChange={(event) =>
              onChange({
                topicMatchMode: event.target.value === 'all' ? 'all' : 'any',
              })
            }
          >
            <option value="any">Match any</option>
            <option value="all">Match all</option>
          </select>
        </label>
        <label className="flex min-h-[var(--cp-control-height)] items-center gap-2 self-end text-sm text-foreground">
          <input
            type="checkbox"
            checked={filters.includeSubtopics}
            onChange={(event) =>
              onChange({ includeSubtopics: event.target.checked })
            }
          />
          Include subtopics
        </label>
      </div>
    </div>
  )
}
