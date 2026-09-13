import { describe, expect, it } from 'vitest'

import {
  formatProblemLibraryStatus,
  getProblemLibraryStatusTone,
} from './problem-library-formatting'

describe('problem library status formatting', () => {
  it('uses the user-facing New and Due today labels', () => {
    expect(formatProblemLibraryStatus('not-started')).toBe('New')
    expect(formatProblemLibraryStatus('due')).toBe('Due today')
  })

  it('presents overdue rows as danger status', () => {
    expect(formatProblemLibraryStatus('overdue')).toBe('Overdue')
    expect(getProblemLibraryStatusTone('overdue')).toBe('danger')
  })
})
