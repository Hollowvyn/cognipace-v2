import { describe, expect, it, vi } from 'vitest'

import {
  computeNotificationDryRun,
  createDevSmokeService,
  type DevSmokeDeps,
} from './dev-smoke-service'

describe('createDevSmokeService', () => {
  it('returns ordered pass checks for reachable dependencies', async () => {
    const deps = createDeps()
    vi.mocked(deps.runLiveGenAi).mockResolvedValue({
      status: 'pass',
      detail: 'Provider responded.',
      latencyMs: 42,
    })

    const report = await createDevSmokeService(deps).run({
      runLiveGenAi: true,
    })

    expect(report.generatedAt).toBe('2026-06-07T12:00:00.000Z')
    expect(report.checks.map((check) => check.id)).toEqual([
      'health',
      'analytics',
      'queue',
      'notifications',
      'genai.config',
      'genai.live',
    ])
    expect(report.checks.map((check) => check.status)).toEqual([
      'pass',
      'pass',
      'pass',
      'skip',
      'pass',
      'pass',
    ])
    expect(report.checks.at(-1)).toMatchObject({
      id: 'genai.live',
      latencyMs: 42,
    })
  })

  it('skips live GenAI when not requested without calling the live dependency', async () => {
    const deps = createDeps()

    const report = await createDevSmokeService(deps).run({})

    expect(deps.runLiveGenAi).not.toHaveBeenCalled()
    expect(report.checks.at(-1)).toMatchObject({
      id: 'genai.live',
      status: 'skip',
    })
  })

  it('redacts provider-style secrets in failure details', async () => {
    const deps = createDeps()
    vi.mocked(deps.readQueueSummary).mockRejectedValue(
      new Error('Provider rejected sk-test-secret for this request'),
    )
    vi.mocked(deps.runLiveGenAi).mockRejectedValue(
      new Error('Gemini key AIzaSyVerySecretValue failed'),
    )

    const report = await createDevSmokeService(deps).run({
      runLiveGenAi: true,
    })

    const serialized = JSON.stringify(report)

    expect(serialized).not.toContain('sk-test-secret')
    expect(serialized).not.toContain('AIzaSyVerySecretValue')
    const queueCheck = report.checks.find((check) => check.id === 'queue')
    const liveGenAiCheck = report.checks.find(
      (check) => check.id === 'genai.live',
    )

    expect(queueCheck).toMatchObject({
      status: 'fail',
    })
    expect(queueCheck?.detail).toContain('[redacted-secret]')
    expect(liveGenAiCheck).toMatchObject({
      status: 'fail',
    })
    expect(liveGenAiCheck?.detail).toContain('[redacted-secret]')
  })

  it('fails analytics when memoryProfile is missing', async () => {
    const deps = createDeps()
    vi.mocked(deps.readAnalyticsSummary).mockResolvedValue(
      {} as Awaited<ReturnType<DevSmokeDeps['readAnalyticsSummary']>>,
    )

    const report = await createDevSmokeService(deps).run({})

    expect(
      report.checks.find((check) => check.id === 'analytics'),
    ).toMatchObject({
      status: 'fail',
      detail: 'Analytics summary is missing memoryProfile.',
    })
  })

  it.each([
    {
      name: 'auto assessment is disabled',
      config: {
        autoAssessmentEnabled: false,
        aiAssessmentEnabled: true,
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        secretPresent: true,
        verificationState: 'valid' as const,
        ready: false,
        reason: 'auto-assessment-disabled',
      },
      detail: 'Auto assessment is disabled.',
    },
    {
      name: 'AI assessment is disabled',
      config: {
        autoAssessmentEnabled: true,
        aiAssessmentEnabled: false,
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        secretPresent: true,
        verificationState: 'valid' as const,
        ready: false,
        reason: 'ai-assessment-disabled',
      },
      detail: 'AI assessment is disabled.',
    },
    {
      name: 'selected provider is unverified with a secret',
      config: {
        autoAssessmentEnabled: true,
        aiAssessmentEnabled: true,
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        secretPresent: true,
        verificationState: 'unverified',
        ready: false,
        reason: 'provider-unverified',
      },
      detail:
        'Provider gemini is selected with model gemini-2.5-flash; verification unverified; secret present: yes.',
    },
    {
      name: 'selected provider is invalid with a secret',
      config: {
        autoAssessmentEnabled: true,
        aiAssessmentEnabled: true,
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        secretPresent: true,
        verificationState: 'invalid',
        ready: false,
        reason: 'provider-invalid',
      },
      detail:
        'Provider gemini is selected with model gemini-2.5-flash; verification invalid; secret present: yes.',
    },
    {
      name: 'selected provider is missing a secret',
      config: {
        autoAssessmentEnabled: true,
        aiAssessmentEnabled: true,
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        secretPresent: false,
        verificationState: 'valid' as const,
        ready: false,
        reason: 'secret-missing',
      },
      detail:
        'Provider gemini is selected with model gemini-2.5-flash; verification valid; secret present: no.',
    },
    {
      name: 'selected provider is ready',
      config: {
        autoAssessmentEnabled: true,
        aiAssessmentEnabled: true,
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        secretPresent: true,
        verificationState: 'valid',
        ready: true,
        reason: null,
      },
      status: 'pass',
      detail:
        'Provider gemini is ready with model gemini-2.5-flash; secret present: yes.',
    },
  ] as const)('reports GenAI config when $name', async (scenario) => {
    const deps = createDeps()
    vi.mocked(deps.readGenAiConfig).mockResolvedValue(scenario.config)

    const report = await createDevSmokeService(deps).run({})

    expect(
      report.checks.find((check) => check.id === 'genai.config'),
    ).toMatchObject({
      status: scenario.status ?? 'warn',
      detail: scenario.detail,
    })
  })
})

describe('computeNotificationDryRun', () => {
  it('skips when daily reminders are disabled', () => {
    expect(
      computeNotificationDryRun({
        now: new Date('2026-06-07T12:00:00.000Z'),
        reminders: { daily: { enabled: false, time: '09:00' } },
        dueToday: 3,
        lastNotifiedDate: null,
      }),
    ).toEqual({
      status: 'skip',
      detail: 'Daily reminders are disabled.',
    })
  })

  it('skips when there are no due reviews', () => {
    expect(
      computeNotificationDryRun({
        now: new Date('2026-06-07T12:00:00.000Z'),
        reminders: { daily: { enabled: true, time: '09:00' } },
        dueToday: 0,
        lastNotifiedDate: null,
      }),
    ).toEqual({
      status: 'skip',
      detail: 'No due reviews are available for a reminder.',
    })
  })

  it('skips when a reminder was already sent today', () => {
    expect(
      computeNotificationDryRun({
        now: new Date('2026-06-07T12:00:00.000Z'),
        reminders: { daily: { enabled: true, time: '09:00' } },
        dueToday: 2,
        lastNotifiedDate: '2026-06-07',
      }),
    ).toEqual({
      status: 'skip',
      detail: 'A due-review reminder was already sent today.',
    })
  })

  it('passes when a reminder would be sent without mutating state', () => {
    expect(
      computeNotificationDryRun({
        now: new Date('2026-06-07T12:00:00.000Z'),
        reminders: { daily: { enabled: true, time: '09:00' } },
        dueToday: 4,
        lastNotifiedDate: '2026-06-06',
      }),
    ).toEqual({
      status: 'pass',
      detail: 'Would send a 09:00 reminder for 4 due reviews.',
    })
  })
})

function createDeps(): DevSmokeDeps {
  return {
    now: () => new Date('2026-06-07T12:00:00.000Z'),
    readAnalyticsSummary: vi.fn(() =>
      Promise.resolve({
        memoryProfile: { totalTracked: 3 },
      }),
    ),
    readQueueSummary: vi.fn(() =>
      Promise.resolve({
        dueToday: 1,
        newAvailable: 2,
        queueLoad: 3,
        recommendationReason: 'due-now',
      }),
    ),
    readGenAiConfig: vi.fn(() =>
      Promise.resolve({
        autoAssessmentEnabled: true,
        aiAssessmentEnabled: true,
        provider: 'openai',
        model: 'gpt-4.1-mini',
        secretPresent: true,
        verificationState: 'valid' as const,
        ready: true,
        reason: null,
      }),
    ),
    runNotificationDryRun: vi.fn(() =>
      Promise.resolve({
        status: 'skip' as const,
        detail: 'Dry-run wiring is available; notification was not sent.',
      }),
    ),
    runLiveGenAi: vi.fn(() =>
      Promise.resolve({
        status: 'skip' as const,
        detail: 'Live GenAI was not requested.',
      }),
    ),
  }
}
