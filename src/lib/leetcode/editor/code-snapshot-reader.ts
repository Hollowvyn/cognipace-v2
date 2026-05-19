import type { LeetCodeCodeSnapshot } from '../domain/types'

export function readLeetCodeCodeSnapshot(
  editorRoot: ParentNode = document,
  now = Date.now,
): LeetCodeCodeSnapshot {
  const visibleMonacoEditorCode = readVisibleMonacoEditorCode(editorRoot)
  const textareaEditorCode = readTextareaEditorCode(editorRoot)
  const detectedEditorCode = visibleMonacoEditorCode ?? textareaEditorCode

  return {
    code: detectedEditorCode,
    language: readSelectedLanguageLabel(editorRoot),
    source: visibleMonacoEditorCode
      ? 'monaco'
      : textareaEditorCode
        ? 'textarea'
        : 'none',
    capturedAt: now(),
  }
}

function readVisibleMonacoEditorCode(editorRoot: ParentNode) {
  const visibleEditorLines = Array.from(
    editorRoot.querySelectorAll('.view-lines .view-line'),
  ).map((line) => line.textContent ?? '')

  return visibleEditorLines.length > 0
    ? visibleEditorLines.join('\n').trimEnd()
    : null
}

function readTextareaEditorCode(editorRoot: ParentNode) {
  const editorTextarea = editorRoot.querySelector<HTMLTextAreaElement>(
    '.monaco-editor textarea, textarea',
  )
  const textareaEditorCode = editorTextarea?.value

  return textareaEditorCode && textareaEditorCode.length > 0
    ? textareaEditorCode
    : null
}

function readSelectedLanguageLabel(editorRoot: ParentNode) {
  const languageSelectorCandidates = [
    '[data-cy="lang-select"]',
    '[data-e2e-locator="console-language-picker"]',
    'button[aria-haspopup="listbox"]',
    'button[aria-label*="language" i]',
  ] as const

  for (const selector of languageSelectorCandidates) {
    const languageLabel = editorRoot
      .querySelector(selector)
      ?.textContent?.trim()

    if (languageLabel) {
      return languageLabel
    }
  }

  return null
}
