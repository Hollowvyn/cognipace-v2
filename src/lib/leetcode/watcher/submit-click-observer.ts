import type {
  LeetCodeProblemLocation,
  LeetCodeSubmissionClick,
} from '../domain/types'

export function readLeetCodeSubmissionClickFromMouseEvent(
  event: MouseEvent,
  options: {
    location: LeetCodeProblemLocation
    now: () => number
  },
): LeetCodeSubmissionClick | null {
  if (!(event.target instanceof Element)) {
    return null
  }

  const button = findSubmitButton(event.target)

  if (!button) {
    return null
  }

  return {
    location: options.location,
    clickedAt: options.now(),
    buttonText: button.textContent?.trim() || 'Submit',
  }
}

function findSubmitButton(target: Element) {
  const button = target.closest(
    [
      '[data-e2e-locator="console-submit-button"]',
      'button[data-cy="submit-code-btn"]',
      'button',
    ].join(','),
  )

  if (!button) {
    return null
  }

  const text = button.textContent?.trim().toLowerCase() ?? ''
  const hasSubmitLocator =
    button.matches('[data-e2e-locator="console-submit-button"]') ||
    button.matches('button[data-cy="submit-code-btn"]')

  return hasSubmitLocator || text === 'submit' ? button : null
}
