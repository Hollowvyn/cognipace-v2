import { FilterX, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

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
  visibleCount,
}: {
  filters: ProblemLibraryFilters
  library: ProblemLibraryResponse
  onChange: (filters: ProblemLibraryFilters) => void
  visibleCount: number
}) {
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true)
  const hasFilters = hasProblemLibraryFilters(filters)

  function patchFilters(patch: Partial<ProblemLibraryFilters>) {
    onChange({ ...filters, ...patch })
  }

  const visibleCountText =
    visibleCount === library.summary.totalCount
      ? `${visibleCount} ${visibleCount === 1 ? 'problem' : 'problems'}`
      : `${visibleCount} of ${library.summary.totalCount} shown`

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
          label={isFilterPanelOpen ? 'Hide filters' : 'Show filters'}
          onClick={() => setIsFilterPanelOpen((current) => !current)}
          tooltip={isFilterPanelOpen ? 'Hide filters' : 'Show filters'}
          variant="outline"
        >
          <SlidersHorizontal aria-hidden="true" />
        </IconButton>
      </div>

      {isFilterPanelOpen ? (
        <div className="grid gap-3 border-t border-border pt-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_minmax(12rem,1.1fr)]">
            <ProblemLibrarySelect
              label="Difficulty"
              name="problem-library-difficulty"
              onChange={(difficulty) =>
                patchFilters({
                  difficultyValues: difficulty === 'all' ? [] : [difficulty],
                })
              }
              options={[
                ['all', 'All difficulties'],
                ['easy', 'Easy'],
                ['medium', 'Medium'],
                ['hard', 'Hard'],
                ['unknown', 'Unknown'],
              ]}
              value={filters.difficultyValues[0] ?? 'all'}
            />
            <ProblemLibrarySelect
              label="Status"
              name="problem-library-status"
              onChange={(status) =>
                patchFilters({
                  statusValues: status === 'all' ? [] : [status],
                })
              }
              options={[
                ['all', 'All statuses'],
                ['not-started', 'Not started'],
                ['due', 'Due'],
                ['scheduled', 'Scheduled'],
                ['suspended', 'Suspended'],
              ]}
              value={filters.statusValues[0] ?? 'all'}
            />
            <ProblemLibrarySelect
              label="Topics"
              name="problem-library-topic"
              onChange={(topicId) =>
                patchFilters({
                  topicIds: topicId === 'all' ? [] : [topicId],
                })
              }
              options={[
                ['all', 'All topics'],
                ...library.options.topics.map(
                  (topic) => [topic.id, topic.label] as const,
                ),
              ]}
              value={filters.topicIds[0] ?? 'all'}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(12rem,22rem)_auto_auto] md:items-center md:justify-start">
            <ProblemLibrarySelect
              label="Companies"
              name="problem-library-company"
              onChange={(companyId) =>
                patchFilters({
                  companyIds: companyId === 'all' ? [] : [companyId],
                })
              }
              options={[
                ['all', 'All companies'],
                ...library.options.companies.map(
                  (company) => [company.id, company.label] as const,
                ),
              ]}
              value={filters.companyIds[0] ?? 'all'}
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

          <div className="flex min-w-0 items-center justify-end gap-4 pt-1 text-[length:var(--cp-copy-font-size)]">
            <span className="tabular-nums text-muted-foreground">
              {visibleCountText}
            </span>
            <Button
              className="px-0 uppercase"
              disabled={!hasFilters}
              onClick={() => onChange(defaultProblemLibraryFilters)}
              size="sm"
              variant="ghost"
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

function ProblemLibrarySelect<TValue extends string>({
  label,
  name,
  onChange,
  options,
  value,
}: {
  label: string
  name: string
  onChange: (value: TValue) => void
  options: readonly (readonly [TValue, string])[]
  value: TValue
}) {
  const labelId = `${name}-label`

  return (
    <label className="relative block min-w-0 pt-2">
      <span
        className="absolute left-3 top-0 z-10 max-w-[calc(100%-1.5rem)] truncate bg-card px-1 text-[length:var(--cp-badge-font-size)] font-semibold leading-none text-muted-foreground"
        id={labelId}
      >
        {label}
      </span>
      <select
        aria-labelledby={labelId}
        className="h-[var(--cp-control-height-lg)] w-full min-w-0 rounded-[var(--cp-control-radius)] border border-border bg-card px-3 pt-1 text-[length:var(--cp-control-font-size)] text-foreground transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        name={name}
        onChange={(event) => onChange(event.target.value as TValue)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  )
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
