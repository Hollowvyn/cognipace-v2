import { describe, expect, it } from 'vitest'

import {
  formatProblemLibraryStatus,
  getProblemLibraryStatusTone,
} from './problem-library-formatting'

describe('problem library status formatting', () => {
  it('presents overdue rows as danger status', () => {
    expect(formatProblemLibraryStatus('overdue')).toBe('Overdue')
    expect(getProblemLibraryStatusTone('overdue')).toBe('danger')
  })
})
