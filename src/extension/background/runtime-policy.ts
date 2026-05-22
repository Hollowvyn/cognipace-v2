import type { ExtensionSurface } from '@/extension/messaging'

const methodSurfaceAccess = {
  'runtime.ping': ['background', 'popup', 'dashboard', 'content-script'],
  'app.getShellData': ['popup', 'dashboard', 'content-script'],
  'problems.upsertFromPage': ['content-script', 'dashboard'],
  'practice.getDetails': ['popup', 'dashboard', 'content-script'],
  'practice.saveReviewResult': ['popup', 'dashboard', 'content-script'],
  'practice.overrideLastReviewResult': ['popup', 'dashboard', 'content-script'],
  'practice.setSuspended': ['popup', 'dashboard', 'content-script'],
  'practice.resetSchedule': ['popup', 'dashboard', 'content-script'],
  'practice.updateCurrentLog': ['popup', 'dashboard', 'content-script'],
  'queue.getTodayQueue': ['popup', 'dashboard'],
  'tracks.getActiveTrack': ['popup', 'dashboard'],
  'settings.getSettings': ['popup', 'dashboard'],
  'settings.updateSettings': ['popup', 'dashboard'],
  'settings.toggleStudyMode': ['popup', 'dashboard'],
  'leetcode.readProblemMetadata': ['content-script'],
  'leetcode.readProblemContent': ['content-script'],
  'leetcode.readSubmissionResult': ['content-script'],
} as const satisfies Record<string, readonly ExtensionSurface[]>

export type ExtensionMethod = keyof typeof methodSurfaceAccess

export function isExtensionMethod(method: string): method is ExtensionMethod {
  return method in methodSurfaceAccess
}

export function canCallExtensionMethod(
  method: string,
  surface: ExtensionSurface,
) {
  return (
    isExtensionMethod(method) &&
    (methodSurfaceAccess[method] as readonly ExtensionSurface[]).includes(
      surface,
    )
  )
}

export function assertCanCallExtensionMethod(
  method: string,
  surface: ExtensionSurface,
) {
  if (!canCallExtensionMethod(method, surface)) {
    throw new Error(`Surface "${surface}" is not allowed to call "${method}".`)
  }
}

export function getMessageSenderSurface(
  sender: unknown,
): ExtensionSurface | null {
  const messageSender = readMessageSender(sender)
  const senderUrl = messageSender.url ?? messageSender.origin

  if (senderUrl) {
    const extensionPageSurface = getExtensionPageSurface(senderUrl)

    if (extensionPageSurface) {
      return extensionPageSurface
    }
  }

  if (messageSender.tab) {
    return 'content-script'
  }

  return null
}

function getExtensionPageSurface(value: string): ExtensionSurface | null {
  const senderPath = readUrlPathname(value)

  if (senderPath.endsWith('/popup.html')) {
    return 'popup'
  }

  if (senderPath.endsWith('/dashboard.html')) {
    return 'dashboard'
  }

  return null
}

export function assertCanSenderCallExtensionMethod(
  method: string,
  requestedSurface: ExtensionSurface,
  sender: unknown,
) {
  const senderSurface = getMessageSenderSurface(sender)

  if (!senderSurface) {
    throw new Error(`Unable to resolve sender surface for "${method}".`)
  }

  if (senderSurface !== requestedSurface) {
    throw new Error(
      `Sender surface "${senderSurface}" cannot claim "${requestedSurface}".`,
    )
  }

  assertCanCallExtensionMethod(method, senderSurface)
}

function readMessageSender(sender: unknown) {
  if (!isRecord(sender)) {
    return {}
  }

  return {
    tab: sender.tab,
    url: typeof sender.url === 'string' ? sender.url : undefined,
    origin: typeof sender.origin === 'string' ? sender.origin : undefined,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readUrlPathname(value: string) {
  try {
    return new URL(value).pathname
  } catch {
    return ''
  }
}
