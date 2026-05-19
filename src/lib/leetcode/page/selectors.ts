export const leetCodeProblemMetadataRootSelectors = [
  '[data-track-load="description_content"]',
  '[data-cy="question-detail-main-tabs"]',
  '[data-e2e-locator="question-detail"]',
  'main',
  '[role="main"]',
] as const

export const leetCodeVisibleTitleSelectors = [
  '[data-cy="question-title"]',
  '[data-e2e-locator="question-title"]',
  'div[data-track-load="description_content"] h1',
  'h1',
] as const

export const leetCodePageTitleSelectors = [
  'meta[property="og:title"]',
] as const

export const leetCodeFrontendIdSelectors = [
  '[data-cy="question-title"]',
  '[data-e2e-locator="question-title"]',
  'h1',
] as const

export const leetCodeDifficultyCandidatesSelector =
  '[diff], [data-difficulty], [class*="difficulty" i], span, p'

export const leetCodeScopedDifficultySelectors = [
  '[data-difficulty]',
  '[class*="difficulty" i]',
  '[diff]',
] as const

export const leetCodePremiumSelector = [
  '[aria-label*="premium" i]',
  '[title*="premium" i]',
  '[alt*="premium" i]',
  '[data-tooltip*="premium" i]',
  '[data-tooltip-content*="premium" i]',
].join(',')

export const leetCodePremiumTextCandidatesSelector = 'button,span,div,a,p'

export const leetCodeTopicLinkSelector =
  'a[href*="/tag/"], a[href*="/problem-list/"]'
