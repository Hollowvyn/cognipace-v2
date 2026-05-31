const retryDelaysMinutes = [1, 5, 15, 30] as const

export function readAutoSyncRetryDelayMinutes(attempt: number) {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new Error('Auto-sync retry attempt must be a non-negative integer.')
  }

  const delay =
    retryDelaysMinutes[Math.min(attempt, retryDelaysMinutes.length - 1)]

  if (delay === undefined) {
    throw new Error('Auto-sync retry delay is not configured.')
  }

  return delay
}
