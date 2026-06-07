import type { DevSmokeReport } from '@/features/dev-smoke'

export type SmokeStatus = DevSmokeReport['checks'][number]['status']

export interface DevSmokeDeps {
  now: () => Date
  readAnalyticsSummary: () => Promise<{ memoryProfile?: unknown }>
  readQueueSummary: () => Promise<{
    dueToday: number
    newAvailable: number
    queueLoad: number
    recommendationReason: string | null
  }>
  readGenAiConfig: () => Promise<{
    enabled: boolean
    provider: string
    model: string
    hasSecret: boolean
  }>
  runNotificationDryRun: () => Promise<{ status: SmokeStatus; detail: string }>
  runLiveGenAi: () => Promise<{
    status: SmokeStatus
    detail: string
    latencyMs?: number
  }>
}

type SmokeCheck = DevSmokeReport['checks'][number]

export function createDevSmokeService(deps: DevSmokeDeps) {
  return {
    async run(input: { runLiveGenAi?: boolean }): Promise<DevSmokeReport> {
      const generatedAt = deps.now().toISOString()
      const checks: SmokeCheck[] = [
        createCheck({
          id: 'health',
          label: 'Background health',
          status: 'pass',
          detail: 'Background dev smoke service is reachable.',
        }),
        await runAnalyticsCheck(deps),
        await runQueueCheck(deps),
        await runNotificationCheck(deps),
        await runGenAiConfigCheck(deps),
        input.runLiveGenAi
          ? await runLiveGenAiCheck(deps)
          : createCheck({
              id: 'genai.live',
              label: 'Live GenAI',
              status: 'skip',
              detail: 'Live GenAI was not requested.',
            }),
      ]

      return { generatedAt, checks }
    },
  }
}

async function runAnalyticsCheck(deps: DevSmokeDeps): Promise<SmokeCheck> {
  try {
    const summary = await deps.readAnalyticsSummary()
    return createCheck({
      id: 'analytics',
      label: 'Analytics summary',
      status: 'pass',
      detail:
        summary.memoryProfile === undefined
          ? 'Analytics summary loaded without a memory profile.'
          : 'Analytics summary loaded with a memory profile.',
    })
  } catch (error) {
    return createFailureCheck('analytics', 'Analytics summary', error)
  }
}

async function runQueueCheck(deps: DevSmokeDeps): Promise<SmokeCheck> {
  try {
    const queue = await deps.readQueueSummary()
    return createCheck({
      id: 'queue',
      label: 'Today queue',
      status: 'pass',
      detail: `Queue loaded: ${queue.dueToday} due today, ${queue.newAvailable} new available, load ${queue.queueLoad}, recommendation ${queue.recommendationReason ?? 'none'}.`,
    })
  } catch (error) {
    return createFailureCheck('queue', 'Today queue', error)
  }
}

async function runNotificationCheck(deps: DevSmokeDeps): Promise<SmokeCheck> {
  try {
    const dryRun = await deps.runNotificationDryRun()
    return createCheck({
      id: 'notifications',
      label: 'Notifications',
      status: dryRun.status,
      detail: dryRun.detail,
    })
  } catch (error) {
    return createFailureCheck('notifications', 'Notifications', error)
  }
}

async function runGenAiConfigCheck(deps: DevSmokeDeps): Promise<SmokeCheck> {
  try {
    const config = await deps.readGenAiConfig()
    return createCheck({
      id: 'genai.config',
      label: 'GenAI config',
      status: 'pass',
      detail: config.enabled
        ? `Provider ${config.provider} is configured with model ${config.model}; secret present: ${config.hasSecret ? 'yes' : 'no'}.`
        : `Provider ${config.provider} is not configured; model ${config.model}; secret present: no.`,
    })
  } catch (error) {
    return createFailureCheck('genai.config', 'GenAI config', error)
  }
}

async function runLiveGenAiCheck(deps: DevSmokeDeps): Promise<SmokeCheck> {
  try {
    const result = await deps.runLiveGenAi()
    return createCheck({
      id: 'genai.live',
      label: 'Live GenAI',
      status: result.status,
      detail: result.detail,
      ...(result.latencyMs !== undefined
        ? { latencyMs: result.latencyMs }
        : {}),
    })
  } catch (error) {
    return createFailureCheck('genai.live', 'Live GenAI', error)
  }
}

function createFailureCheck(
  id: string,
  label: string,
  error: unknown,
): SmokeCheck {
  return createCheck({
    id,
    label,
    status: 'fail',
    detail: redactSecrets(readErrorMessage(error)),
  })
}

function createCheck(check: SmokeCheck): SmokeCheck {
  return {
    ...check,
    detail: redactSecrets(check.detail),
  }
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function redactSecrets(value: string) {
  return value
    .replace(/\bsk-ant-[A-Za-z0-9_-]+\b/g, '[redacted-secret]')
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[redacted-secret]')
    .replace(/\bAIza[A-Za-z0-9_-]+\b/g, '[redacted-secret]')
}
