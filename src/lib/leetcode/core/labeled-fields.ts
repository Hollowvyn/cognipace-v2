import { escapeRegExp } from './dom-text'

export function readBoundedTextAfterLabel(options: {
  text: string
  labels: readonly string[]
  stopLabelPatterns: readonly string[]
  maxLength?: number | undefined
}) {
  const joinedLabels = options.labels.map(escapeRegExp).join('|')
  const joinedStopLabels = options.stopLabelPatterns.join('|')
  const match = options.text.match(
    new RegExp(
      `\\b(?:${joinedLabels})\\b\\s*:?\\s*([\\s\\S]+?)(?:\\b(?:${joinedStopLabels})\\b|$)`,
      'i',
    ),
  )
  const value = match?.[1]?.trim()

  return value ? value.slice(0, options.maxLength ?? 500) : null
}
