export function readNormalizedText(node: ParentNode) {
  if (node.nodeType === Node.DOCUMENT_NODE) {
    return readNormalizedText((node as Document).body)
  }

  return stripRepeatedWhitespace(node.textContent ?? '')
}

export function readMultilineText(node: ParentNode) {
  return (node.textContent ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function readTextFromHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|pre|li|ul|ol|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export function stripRepeatedWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
