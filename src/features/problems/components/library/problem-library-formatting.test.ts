import { describe, expect, it } from 'vitest'

import {
  formatProblemLibraryStatus,
  getProblemLibraryStatusTone,
} from './problem-library-formatting'

describe('problem library status formatting', () => {
  it('uses the user-facing label for every library status', () => {
    expect(formatProblemLibraryStatus('not-started')).toBe('New')
    expect(formatProblemLibraryStatus('overdue')).toBe('Overdue')
    expect(formatProblemLibraryStatus('due')).toBe('Due today')
    expect(formatProblemLibraryStatus('scheduled')).toBe('Scheduled')
    expect(formatProblemLibraryStatus('suspended')).toBe('Suspended')
  })

  it('preserves the overdue danger tone', () => {
    expect(getProblemLibraryStatusTone('overdue')).toBe('danger')
  })
})
