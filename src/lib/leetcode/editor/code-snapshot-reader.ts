import type { LeetCodeCodeSnapshot } from '../domain/types'

export function readLeetCodeCodeSnapshot(
  root: ParentNode = document,
  now = Date.now,
): LeetCodeCodeSnapshot {
  const monacoCode = readMonacoCode(root)
  const textareaCode = readTextareaCode(root)
  const code = monacoCode ?? textareaCode

  return {
    code,
    language: readLanguage(root),
    source: monacoCode ? 'monaco' : textareaCode ? 'textarea' : 'none',
    capturedAt: now(),
  }
}

function readMonacoCode(root: ParentNode) {
  const lines = Array.from(root.querySelectorAll('.view-lines .view-line')).map(
    (line) => line.textContent ?? '',
  )

  return lines.length > 0 ? lines.join('\n').trimEnd() : null
}

function readTextareaCode(root: ParentNode) {
  const textarea = root.querySelector<HTMLTextAreaElement>(
    '.monaco-editor textarea, textarea',
  )
  const value = textarea?.value

  return value && value.length > 0 ? value : null
}

function readLanguage(root: ParentNode) {
  const selectors = [
    '[data-cy="lang-select"]',
    '[data-e2e-locator="console-language-picker"]',
    'button[aria-haspopup="listbox"]',
    'button[aria-label*="language" i]',
  ] as const

  for (const selector of selectors) {
    const text = root.querySelector(selector)?.textContent?.trim()

    if (text) {
      return text
    }
  }

  return null
}
