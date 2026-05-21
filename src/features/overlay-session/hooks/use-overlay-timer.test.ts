import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useOverlayTimer } from './use-overlay-timer'

describe('useOverlayTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts, pauses, resumes, and resets elapsed time', () => {
    const { result } = renderHook(() => useOverlayTimer())

    act(() => result.current.start())
    tick(3000)

    expect(result.current.status).toBe('running')
    expect(result.current.elapsedSeconds).toBe(3)

    act(() => result.current.pause())
    tick(5000)

    expect(result.current.status).toBe('paused')
    expect(result.current.elapsedSeconds).toBe(3)

    act(() => result.current.start())
    tick(2000)

    expect(result.current.status).toBe('running')
    expect(result.current.elapsedSeconds).toBe(5)

    act(() => result.current.reset())

    expect(result.current.status).toBe('idle')
    expect(result.current.elapsedSeconds).toBe(0)
  })

  it('locks at a safe elapsed value and ignores later starts', () => {
    const { result } = renderHook(() => useOverlayTimer())

    act(() => {
      expect(result.current.lockAt(95.9)).toBe(95)
    })

    expect(result.current.status).toBe('locked')
    expect(result.current.elapsedSeconds).toBe(95)

    act(() => result.current.start())
    tick(10_000)

    expect(result.current.status).toBe('locked')
    expect(result.current.elapsedSeconds).toBe(95)
  })

  it('clamps null and negative lock values to zero', () => {
    const { result, rerender } = renderHook(() => useOverlayTimer())

    act(() => {
      expect(result.current.lockAt(null)).toBe(0)
    })
    expect(result.current.elapsedSeconds).toBe(0)

    act(() => result.current.reset())
    rerender()
    act(() => {
      expect(result.current.lockAt(-12)).toBe(0)
    })

    expect(result.current.status).toBe('locked')
    expect(result.current.elapsedSeconds).toBe(0)
  })
})

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}
