const leetCodeLanguageLabels = [
  'MS SQL Server',
  'JavaScript',
  'TypeScript',
  'PostgreSQL',
  'Python3',
  'Python',
  'Kotlin',
  'Racket',
  'Erlang',
  'Elixir',
  'Pandas',
  'Oracle',
  'MySQL',
  'Scala',
  'Swift',
  'Ruby',
  'Rust',
  'Bash',
  'Java',
  'Dart',
  'PHP',
  'SQL',
  'C++',
  'C#',
  'Go',
  'C',
] as const

const leetCodeLanguageAliases = new Map<string, string>([
  ['cpp', 'C++'],
  ['c++', 'C++'],
  ['csharp', 'C#'],
  ['c#', 'C#'],
  ['golang', 'Go'],
  ['go', 'Go'],
  ['js', 'JavaScript'],
  ['javascript', 'JavaScript'],
  ['ts', 'TypeScript'],
  ['typescript', 'TypeScript'],
  ['python3', 'Python3'],
  ['python 3', 'Python3'],
  ['python', 'Python'],
  ['py', 'Python'],
  ['mysql', 'MySQL'],
  ['mssql', 'MS SQL Server'],
  ['ms sql server', 'MS SQL Server'],
  ['postgres', 'PostgreSQL'],
  ['postgresql', 'PostgreSQL'],
])

export function normalizeLeetCodeLanguageLabel(
  value: string | null | undefined,
) {
  if (!value) {
    return null
  }

  const normalizedValue = value.replace(/\s+/g, ' ').trim()

  if (!normalizedValue) {
    return null
  }

  const aliasMatch = leetCodeLanguageAliases.get(normalizedValue.toLowerCase())

  if (aliasMatch) {
    return aliasMatch
  }

  const exactLabel = leetCodeLanguageLabels.find(
    (languageLabel) =>
      languageLabel.toLowerCase() === normalizedValue.toLowerCase(),
  )

  return exactLabel ?? normalizedValue
}

export function readLeetCodeLanguageLabelFromText(
  text: string | null | undefined,
) {
  if (!text) {
    return null
  }

  const normalizedText = text.replace(/\s+/g, ' ').trim()

  if (!normalizedText || normalizedText.length > 120) {
    return null
  }

  const codeHeadingLanguage = normalizedText.match(/^Code\s*\|\s*(.+)$/i)?.[1]
  const normalizedCodeHeadingLanguage =
    normalizeLeetCodeLanguageLabel(codeHeadingLanguage)

  if (normalizedCodeHeadingLanguage) {
    return normalizedCodeHeadingLanguage
  }

  const languageMatch = leetCodeLanguageLabels.find((languageLabel) =>
    createLanguageLabelPattern(languageLabel).test(normalizedText),
  )

  return languageMatch ? normalizeLeetCodeLanguageLabel(languageMatch) : null
}

function createLanguageLabelPattern(languageLabel: string) {
  return new RegExp(
    `(^|[^A-Za-z0-9+#])${escapeRegExp(languageLabel)}([^A-Za-z0-9+#]|$)`,
    'i',
  )
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
