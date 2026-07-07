import type { Tone } from '@/components/ui/types'

import type { ProblemLibraryStatus } from '../../api/problems-contracts'

export function formatProblemLibraryStatus(status: ProblemLibraryStatus) {
  switch (status) {
    case 'not-started':
      return 'Not started'
    case 'due':
      return 'Due'
    case 'scheduled':
      return 'Scheduled'
    case 'suspended':
      return 'Suspended'
  }
}

export function getProblemLibraryStatusTone(
  status: ProblemLibraryStatus,
): Tone {
  switch (status) {
    case 'due':
      return 'warning'
    case 'scheduled':
      return 'info'
    case 'suspended':
      return 'danger'
    case 'not-started':
      return 'neutral'
  }
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatDateCell(value: string | null, emptyLabel = '—') {
  if (!value) {
    return emptyLabel
  }

  return dateFormatter.format(new Date(value))
}

export function formatMetric(value: number | null, suffix = '') {
  return value === null ? 'None' : `${Number(value.toFixed(2))}${suffix}`
}

export function formatPercentMetric(value: number | null) {
  if (value === null) {
    return 'None'
  }

  const percent = value <= 1 ? value * 100 : value

  return `${Math.round(percent)}%`
}
