import { useEffect, useRef, useState } from 'react'

export type OverlayTimerStatus = 'idle' | 'running' | 'paused' | 'locked'

export type OverlayTimerController = {
  elapsedSeconds: number
  status: OverlayTimerStatus
  start: () => void
  pause: () => void
  reset: () => void
  lockAt: (elapsedSeconds: number | null) => number
  readElapsedSeconds: () => number
  hasStarted: () => boolean
}

export function useOverlayTimer(): OverlayTimerController {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [status, setStatus] = useState<OverlayTimerStatus>('idle')
  const accumulatedSecondsRef = useRef(0)
  const startedAtRef = useRef<number | null>(null)
  const statusRef = useRef<OverlayTimerStatus>('idle')

  function readCurrentElapsedSeconds() {
    const startedAt = startedAtRef.current

    if (statusRef.current !== 'running' || startedAt === null) {
      return accumulatedSecondsRef.current
    }

    return Math.max(
      0,
      accumulatedSecondsRef.current +
        Math.floor((Date.now() - startedAt) / 1000),
    )
  }

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (status !== 'running') {
      return
    }

    const updateElapsedSeconds = () => {
      setElapsedSeconds(readCurrentElapsedSeconds())
    }
    const intervalId = window.setInterval(updateElapsedSeconds, 1000)

    updateElapsedSeconds()

    return () => window.clearInterval(intervalId)
  }, [status])

  function start() {
    if (statusRef.current === 'locked' || statusRef.current === 'running') {
      return
    }

    startedAtRef.current = Date.now()
    statusRef.current = 'running'
    setStatus('running')
  }

  function pause() {
    if (statusRef.current !== 'running') {
      return
    }

    const nextElapsedSeconds = readCurrentElapsedSeconds()
    accumulatedSecondsRef.current = nextElapsedSeconds
    startedAtRef.current = null
    statusRef.current = nextElapsedSeconds > 0 ? 'paused' : 'idle'
    setElapsedSeconds(nextElapsedSeconds)
    setStatus(statusRef.current)
  }

  function reset() {
    accumulatedSecondsRef.current = 0
    startedAtRef.current = null
    statusRef.current = 'idle'
    setElapsedSeconds(0)
    setStatus('idle')
  }

  function lockAt(nextElapsedSeconds: number | null) {
    const safeElapsedSeconds = Math.max(0, Math.floor(nextElapsedSeconds ?? 0))

    accumulatedSecondsRef.current = safeElapsedSeconds
    startedAtRef.current = null
    statusRef.current = 'locked'
    setElapsedSeconds(safeElapsedSeconds)
    setStatus('locked')

    return safeElapsedSeconds
  }

  function readElapsedSeconds() {
    return readCurrentElapsedSeconds()
  }

  function hasStarted() {
    return statusRef.current !== 'idle'
  }

  return {
    elapsedSeconds,
    status,
    start,
    pause,
    reset,
    lockAt,
    readElapsedSeconds,
    hasStarted,
  }
}
