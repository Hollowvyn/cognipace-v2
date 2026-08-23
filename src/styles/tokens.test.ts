import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const analyticsTokens = readFileSync(
  resolve(process.cwd(), 'src/styles/tokens.css'),
  'utf8',
)

describe('analytics color tokens', () => {
  it('keeps Good teal while Again, Hard, and Easy retain distinct rating semantics', () => {
    expect(analyticsTokens).toContain('--cp-analytics-good: #0f766e;')
    expect(analyticsTokens).toContain('--cp-analytics-good: #5ee6d0;')
    expect(analyticsTokens).toContain(
      '--cp-analytics-again: var(--cp-tone-review-again-fg);',
    )
    expect(analyticsTokens).toContain(
      '--cp-analytics-hard: var(--cp-tone-review-hard-fg);',
    )
    expect(analyticsTokens).toContain(
      '--cp-analytics-easy: var(--cp-tone-review-easy-fg);',
    )
  })

  it('defines light and strong semantic health, watch, risk, and workload roles in every theme', () => {
    const tokens = [
      '--cp-analytics-healthy-subtle:',
      '--cp-analytics-healthy-strong:',
      '--cp-analytics-watch-subtle:',
      '--cp-analytics-watch-strong:',
      '--cp-analytics-risk-subtle:',
      '--cp-analytics-risk-strong:',
      '--cp-analytics-due:',
      '--cp-analytics-overdue:',
    ]

    for (const token of tokens) {
      expect(analyticsTokens.split(token)).toHaveLength(4)
    }
  })
})
