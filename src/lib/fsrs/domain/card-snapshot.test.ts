import { describe, expect, it } from 'vitest'

import {
  defaultFsrsCardKind,
  isFsrsCardKind,
  isFsrsCardState,
  parseFsrsCardKind,
  parseFsrsCardState,
} from './card-snapshot'

describe('FSRS card snapshot contracts', () => {
  it('parses persisted card states through a typed boundary', () => {
    expect(parseFsrsCardState('new')).toBe('new')
    expect(parseFsrsCardState('learning')).toBe('learning')
    expect(parseFsrsCardState('review')).toBe('review')
    expect(parseFsrsCardState('relearning')).toBe('relearning')
    expect(() => parseFsrsCardState('invalid')).toThrow(
      'Invalid FSRS card state "invalid".',
    )
    expect(parseFsrsCardKind('default')).toBe('default')
    expect(() => parseFsrsCardKind('custom')).toThrow(
      'Invalid FSRS card kind "custom".',
    )
  })

  it('checks card states and card kinds without exposing ts-fsrs enums', () => {
    expect(isFsrsCardState('review')).toBe(true)
    expect(isFsrsCardState('Review')).toBe(false)
    expect(isFsrsCardKind(defaultFsrsCardKind)).toBe(true)
    expect(isFsrsCardKind('python')).toBe(false)
  })
})
