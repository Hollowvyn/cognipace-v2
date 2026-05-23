import { FilterX } from 'lucide-react'

import { Button } from '@/components/ui/button'

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
  const hasFilters = hasProblemLibraryFilters(filters)

  function patchFilters(patch: Partial<ProblemLibraryFilters>) {
    onChange({ ...filters, ...patch })
  }

  return (
    <div className="grid gap-2 px-4 md:px-5">
      <div className="flex min-w-0 flex-col gap-2 lg:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search problems</span>
          <input
            className="h-[var(--cp-control-height)] w-full rounded-[var(--cp-control-radius)] border border-border bg-card px-3 text-[length:var(--cp-control-font-size)] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onChange={(event) => patchFilters({ search: event.target.value })}
            placeholder="Search title, slug, topics, companies, tracks"
            type="search"
            value={filters.search}
          />
        </label>
        <Button
          disabled={!hasFilters}
          onClick={() => onChange(defaultProblemLibraryFilters)}
          size="sm"
          variant="outline"
        >
          <FilterX aria-hidden="true" />
          Clear
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <ProblemLibrarySelect
          label="Difficulty"
          onChange={(difficulty) => patchFilters({ difficulty })}
          options={[
            ['all', 'All difficulties'],
            ['easy', 'Easy'],
            ['medium', 'Medium'],
            ['hard', 'Hard'],
            ['unknown', 'Unknown'],
          ]}
          value={filters.difficulty}
        />
        <ProblemLibrarySelect
          label="Status"
          onChange={(status) => patchFilters({ status })}
          options={[
            ['all', 'All statuses'],
            ['not-started', 'Not started'],
            ['due', 'Due'],
            ['scheduled', 'Scheduled'],
            ['suspended', 'Suspended'],
          ]}
          value={filters.status}
        />
        <ProblemLibrarySelect
          label="Premium"
          onChange={(premium) => patchFilters({ premium })}
          options={[
            ['all', 'Free + premium'],
            ['free', 'Free'],
            ['premium', 'Premium'],
          ]}
          value={filters.premium}
        />
        <ProblemLibrarySelect
          label="Topic"
          onChange={(topicId) => patchFilters({ topicId })}
          options={[
            ['all', 'All topics'],
            ...library.options.topics.map(
              (topic) => [topic.id, topic.label] as const,
            ),
          ]}
          value={filters.topicId}
        />
        <ProblemLibrarySelect
          label="Company"
          onChange={(companyId) => patchFilters({ companyId })}
          options={[
            ['all', 'All companies'],
            ...library.options.companies.map(
              (company) => [company.id, company.label] as const,
            ),
          ]}
          value={filters.companyId}
        />
        <ProblemLibrarySelect
          label="Track"
          onChange={(trackGroupId) => patchFilters({ trackGroupId })}
          options={[
            ['all', 'All tracks'],
            ...library.options.trackGroups.map(
              (group) =>
                [
                  group.groupId,
                  `${group.trackTitle}: ${group.groupTitle}`,
                ] as const,
            ),
          ]}
          value={filters.trackGroupId}
        />
      </div>
    </div>
  )
}

function ProblemLibrarySelect<TValue extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: TValue) => void
  options: readonly (readonly [TValue, string])[]
  value: TValue
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-[length:var(--cp-badge-font-size)] font-semibold text-muted-foreground">
        {label}
      </span>
      <select
        className="h-[var(--cp-control-height)] min-w-0 rounded-[var(--cp-control-radius)] border border-border bg-card px-2 text-[length:var(--cp-control-font-size)] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
