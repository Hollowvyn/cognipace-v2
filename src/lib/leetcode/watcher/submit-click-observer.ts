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

  const submitButton = findLeetCodeSubmitButtonFromClickTarget(event.target)

  if (!submitButton) {
    return null
  }

  return {
    location: options.location,
    clickedAt: options.now(),
    buttonText: submitButton.textContent?.trim() || 'Submit',
  }
}

function findLeetCodeSubmitButtonFromClickTarget(clickTarget: Element) {
  const submitButton = clickTarget.closest(
    [
      '[data-e2e-locator="console-submit-button"]',
      'button[data-cy="submit-code-btn"]',
      'button',
    ].join(','),
  )

  if (!submitButton) {
    return null
  }

  const submitButtonText = submitButton.textContent?.trim().toLowerCase() ?? ''
  const matchesKnownSubmitButtonLocator =
    submitButton.matches('[data-e2e-locator="console-submit-button"]') ||
    submitButton.matches('button[data-cy="submit-code-btn"]')

  return matchesKnownSubmitButtonLocator || submitButtonText === 'submit'
    ? submitButton
    : null
}
