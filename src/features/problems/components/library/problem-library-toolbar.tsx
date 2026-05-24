import { Check, ChevronDown, FilterX, SlidersHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/utils/cn'

import type { ProblemLibraryResponse } from '../../api/problems-contracts'
import {
  defaultProblemLibraryFilters,
  hasProblemLibraryFilters,
  type ProblemLibraryFilters,
} from './problem-library-filtering'

export function ProblemLibraryToolbar({
  filters,
  library,
  onChange,
}: {
  filters: ProblemLibraryFilters
  library: ProblemLibraryResponse
  onChange: (filters: ProblemLibraryFilters) => void
}) {
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const hasFilters = hasProblemLibraryFilters(filters)

  function patchFilters(patch: Partial<ProblemLibraryFilters>) {
    onChange({ ...filters, ...patch })
  }

  return (
    <section
      aria-label="Library filters"
      className="grid gap-3 px-4 py-3 md:px-5"
      data-slot="problem-library-toolbar"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <label className="min-w-0 flex-1 sm:max-w-[38rem]">
          <span className="sr-only">Search problems</span>
          <input
            autoComplete="off"
            className="h-[var(--cp-control-height-lg)] w-full rounded-[var(--cp-control-radius)] border border-border bg-card px-3 text-[length:var(--cp-control-font-size)] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            name="problem-library-search"
            onChange={(event) => patchFilters({ search: event.target.value })}
            placeholder="Search problems…"
            type="search"
            value={filters.search}
          />
        </label>
        <IconButton
          aria-pressed={isFilterPanelOpen}
          className="rounded-full"
          label={isFilterPanelOpen ? 'Collapse filters' : 'Expand filters'}
          onClick={() => setIsFilterPanelOpen((current) => !current)}
          tooltip={isFilterPanelOpen ? 'Collapse filters' : 'Expand filters'}
          variant="outline"
        >
          <SlidersHorizontal aria-hidden="true" />
        </IconButton>
      </div>

      {isFilterPanelOpen ? (
        <div className="grid gap-3 border-t border-border pt-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_minmax(12rem,1.1fr)]">
            <ProblemLibraryFacetFilter
              allLabel="All difficulties"
              label="Difficulty"
              options={difficultyOptions}
              value={filters.difficultyValues}
              onChange={(difficultyValues) =>
                patchFilters({ difficultyValues })
              }
            />
            <ProblemLibraryFacetFilter
              allLabel="All statuses"
              label="Status"
              options={statusOptions}
              value={filters.statusValues}
              onChange={(statusValues) => patchFilters({ statusValues })}
            />
            <ProblemLibraryFacetFilter
              allLabel="All tracks"
              label="Track"
              options={createTrackOptions(library)}
              value={filters.trackIds}
              onChange={(trackIds) => patchFilters({ trackIds })}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(12rem,22rem)_minmax(12rem,22rem)_auto_auto] md:items-center md:justify-start">
            <ProblemLibraryFacetFilter
              allLabel="All topics"
              label="Topics"
              options={library.options.topics.map(
                (topic) => [topic.id, topic.label] as const,
              )}
              value={filters.topicIds}
              onChange={(topicIds) => patchFilters({ topicIds })}
            />
            <ProblemLibraryFacetFilter
              allLabel="All companies"
              label="Companies"
              options={library.options.companies.map(
                (company) => [company.id, company.label] as const,
              )}
              value={filters.companyIds}
              onChange={(companyIds) => patchFilters({ companyIds })}
            />
            <ProblemLibraryToggle
              checked={filters.hidePremium}
              label="Hide premium"
              name="problem-library-hide-premium"
              onChange={(hidePremium) => patchFilters({ hidePremium })}
            />
            <ProblemLibraryToggle
              checked={filters.hideSuspended}
              label="Hide suspended"
              name="problem-library-hide-suspended"
              onChange={(hideSuspended) => patchFilters({ hideSuspended })}
            />
          </div>

          <div className="flex min-w-0 items-center justify-end pt-1">
            <Button
              className="px-3 uppercase tracking-[0.08em]"
              disabled={!hasFilters}
              onClick={() => onChange(defaultProblemLibraryFilters)}
              size="sm"
              variant="outline"
            >
              <FilterX aria-hidden="true" />
              Clear Filters
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function createTrackOptions(library: ProblemLibraryResponse) {
  const tracksById = new Map<string, { id: string; label: string }>()

  for (const row of library.rows) {
    for (const membership of row.trackMemberships) {
      tracksById.set(membership.trackId, {
        id: membership.trackId,
        label: membership.trackTitle,
      })
    }
  }

  return [...tracksById.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((track) => [track.id, track.label] as const)
}

const difficultyOptions = [
  ['easy', 'Easy'],
  ['medium', 'Medium'],
  ['hard', 'Hard'],
  ['unknown', 'Unknown'],
] as const

const statusOptions = [
  ['not-started', 'Not started'],
  ['due', 'Due'],
  ['scheduled', 'Scheduled'],
  ['suspended', 'Suspended'],
] as const

function ProblemLibraryFacetFilter<TValue extends string>({
  allLabel,
  label,
  onChange,
  options,
  value,
}: {
  allLabel: string
  label: string
  options: readonly (readonly [TValue, string])[]
  value: readonly TValue[]
  onChange: (value: TValue[]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonId = useId()
  const listboxId = useId()
  const selectedLabelByValue = new Map(
    options.map(([optionValue, optionLabel]) => [optionValue, optionLabel]),
  )
  const selectedSummary = getFacetFilterSummary({
    allLabel,
    selectedLabels: value.map(
      (optionValue) => selectedLabelByValue.get(optionValue) ?? optionValue,
    ),
  })

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  function toggleOption(optionValue: TValue) {
    const nextValue = value.includes(optionValue)
      ? value.filter((selectedValue) => selectedValue !== optionValue)
      : [...value, optionValue]

    onChange(nextValue)
  }

  return (
    <div className="relative min-w-0 pt-2" ref={rootRef}>
      <span
        className="absolute left-3 top-0 z-10 max-w-[calc(100%-1.5rem)] truncate bg-card px-1 text-[length:var(--cp-badge-font-size)] font-semibold leading-none text-muted-foreground"
        id={`${buttonId}-label`}
      >
        {label}
      </span>
      <button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={`${buttonId}-label ${buttonId}`}
        className="flex h-[var(--cp-control-height-lg)] w-full min-w-0 items-center justify-between gap-3 rounded-[var(--cp-control-radius)] border border-border bg-card px-3 pt-1 text-left text-[length:var(--cp-control-font-size)] text-foreground transition-[border-color,box-shadow] hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        id={buttonId}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 truncate">{selectedSummary}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen ? (
        <div
          aria-labelledby={`${buttonId}-label`}
          aria-multiselectable="true"
          className="absolute left-0 top-[calc(100%+0.375rem)] z-30 grid max-h-80 w-full min-w-56 overflow-y-auto rounded-[var(--cp-control-radius)] border border-border bg-popover p-1 text-[length:var(--cp-control-font-size)] text-popover-foreground shadow-lg"
          id={listboxId}
          role="listbox"
        >
          <button
            aria-selected={value.length === 0}
            className={facetOptionClassName(value.length === 0)}
            onClick={() => onChange([])}
            role="option"
            type="button"
          >
            <FacetFilterCheck selected={value.length === 0} />
            <span className="min-w-0 truncate">{allLabel}</span>
          </button>
          {options.map(([optionValue, optionLabel]) => {
            const isSelected = value.includes(optionValue)

            return (
              <button
                aria-selected={isSelected}
                className={facetOptionClassName(isSelected)}
                key={optionValue}
                onClick={() => toggleOption(optionValue)}
                role="option"
                type="button"
              >
                <FacetFilterCheck selected={isSelected} />
                <span className="min-w-0 truncate">{optionLabel}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function FacetFilterCheck({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded border border-border text-primary',
        selected ? 'border-primary bg-primary/15' : 'opacity-60',
      )}
    >
      {selected ? <Check className="size-3" /> : null}
    </span>
  )
}

function facetOptionClassName(selected: boolean) {
  return cn(
    'flex min-h-9 w-full min-w-0 items-center gap-2 rounded-[calc(var(--cp-control-radius)-2px)] px-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    selected && 'bg-muted text-foreground',
  )
}

function getFacetFilterSummary({
  allLabel,
  selectedLabels,
}: {
  allLabel: string
  selectedLabels: readonly string[]
}) {
  if (selectedLabels.length === 0) {
    return allLabel
  }

  if (selectedLabels.length === 1) {
    return selectedLabels[0]
  }

  return `${selectedLabels.length} selected`
}

function ProblemLibraryToggle({
  checked,
  label,
  name,
  onChange,
}: {
  checked: boolean
  label: string
  name: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      aria-checked={checked}
      className="inline-flex min-h-[var(--cp-control-height-lg)] min-w-0 items-center gap-2 rounded-[var(--cp-control-radius)] text-[length:var(--cp-control-font-size)] text-foreground transition-[color,box-shadow] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      name={name}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative inline-flex h-5 w-10 shrink-0 items-center rounded-full border border-border bg-muted transition-[background-color,border-color,box-shadow]',
          checked && 'border-primary bg-primary',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 size-4 rounded-full bg-foreground/85 shadow-sm transition-transform',
            checked && 'translate-x-5 bg-primary-foreground',
          )}
        />
      </span>
      <span className="truncate">{label}</span>
    </button>
  )
}
