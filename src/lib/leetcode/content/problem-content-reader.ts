import DOMPurify from 'dompurify'
import { createLeetCodeProblemContentFingerprint } from './content-fingerprint'
import {
  escapeRegExp,
  readMultilineText,
  readNormalizedText,
  readTextFromHtml,
  stripRepeatedWhitespace,
} from '../core/dom-text'
import { requestLeetCodeProblemContent } from '../api/problem-content-request'
import type { LeetCodeGraphQlFetch } from '../core/graphql-client'
import { isObjectRecord, readTrimmedString } from '../core/value-readers'
import type {
  LeetCodeExample,
  LeetCodeProblemContent,
  LeetCodeProblemContentConfidence,
  LeetCodeProblemContentResult,
  LeetCodeProblemContentSource,
  LeetCodeProblemLocation,
} from '../domain/types'

type ParsedGraphQlQuestionContent = {
  contentHtml: string | null
  hints: string[]
}

const leetCodeProblemContentRootSelectors = [
  '[data-track-load="description_content"]',
  '[data-cy="question-detail-main-tabs"]',
  '[data-e2e-locator="question-detail"]',
  '[class*="question-content" i]',
  '[class*="description" i]',
] as const

export async function readLeetCodeProblemContent(
  location: LeetCodeProblemLocation,
  options: {
    root?: ParentNode | undefined
    document?: Document | undefined
    fetch?: LeetCodeGraphQlFetch | undefined
    csrfToken?: string | null | undefined
    now?: (() => number) | undefined
  } = {},
): Promise<LeetCodeProblemContentResult> {
  const graphQlContentResult = await fetchLeetCodeProblemContent(location, {
    fetch: options.fetch,
    document: options.document,
    csrfToken: options.csrfToken,
    now: options.now,
  })

  if (graphQlContentResult.ok) {
    return graphQlContentResult
  }

  const fallbackRoot = options.root ?? readAvailableDocument(options.document)
  const domContent = fallbackRoot
    ? readLeetCodeProblemContentFromDom(fallbackRoot, {
        location,
        now: options.now,
      })
    : null

  if (domContent) {
    return { ok: true, content: domContent }
  }

  return {
    ok: true,
    content: createProblemContent({
      location,
      statement: '',
      examples: [],
      constraints: [],
      hints: [],
      source: 'fallback',
      confidence: 'low',
      capturedAt: options.now?.() ?? Date.now(),
    }),
  }
}

export async function fetchLeetCodeProblemContent(
  location: LeetCodeProblemLocation,
  options: {
    fetch?: LeetCodeGraphQlFetch | undefined
    document?: Document | undefined
    csrfToken?: string | null | undefined
    now?: (() => number) | undefined
  } = {},
): Promise<LeetCodeProblemContentResult> {
  const graphQlResult = await requestLeetCodeProblemContent({
    locationUrl: location.url,
    slug: location.slug,
    fetch: options.fetch,
    document: options.document,
    csrfToken: options.csrfToken,
  })

  if (!graphQlResult.ok) {
    return graphQlResult
  }

  const parsedQuestionContent = readQuestionContentFromGraphQlPayload(
    graphQlResult.payload,
  )

  if (!parsedQuestionContent?.contentHtml) {
    return {
      ok: false,
      error: new Error('LeetCode GraphQL response did not include content.'),
    }
  }

  const contentDocument = createContentDocumentOrNull(
    parsedQuestionContent.contentHtml,
    options.document,
  )
  const contentParts = contentDocument
    ? readContentPartsFromRoot(contentDocument.body)
    : readContentPartsFromText(
        readTextFromHtml(parsedQuestionContent.contentHtml),
      )

  return {
    ok: true,
    content: createProblemContent({
      location,
      statement: contentParts.statement,
      examples: contentParts.examples,
      constraints: contentParts.constraints,
      hints: parsedQuestionContent.hints,
      source: 'graphql',
      confidence: 'high',
      capturedAt: options.now?.() ?? Date.now(),
    }),
  }
}

export function readLeetCodeProblemContentFromDom(
  pageRoot: ParentNode,
  options: {
    location: LeetCodeProblemLocation
    now?: (() => number) | undefined
  },
): LeetCodeProblemContent | null {
  const contentRoot = findProblemContentRoot(pageRoot)

  if (!contentRoot) {
    return null
  }

  const contentParts = readContentPartsFromRoot(contentRoot)

  if (
    !contentParts.statement &&
    contentParts.examples.length === 0 &&
    contentParts.constraints.length === 0
  ) {
    return null
  }

  return createProblemContent({
    location: options.location,
    statement: contentParts.statement,
    examples: contentParts.examples,
    constraints: contentParts.constraints,
    hints: readHintsFromDomRoot(contentRoot),
    source: 'dom',
    confidence: contentParts.statement ? 'medium' : 'low',
    capturedAt: options.now?.() ?? Date.now(),
  })
}

function createProblemContent(options: {
  location: LeetCodeProblemLocation
  statement: string
  examples: LeetCodeExample[]
  constraints: string[]
  hints: string[]
  source: LeetCodeProblemContentSource
  confidence: LeetCodeProblemContentConfidence
  capturedAt: number
}): LeetCodeProblemContent {
  const contentWithoutFingerprint = {
    location: options.location,
    statement: options.statement,
    examples: options.examples,
    constraints: options.constraints,
    hints: options.hints,
    source: options.source,
    confidence: options.confidence,
    capturedAt: options.capturedAt,
  }

  return {
    ...contentWithoutFingerprint,
    contentFingerprint: createLeetCodeProblemContentFingerprint(
      contentWithoutFingerprint,
    ),
  }
}

function readQuestionContentFromGraphQlPayload(
  payload: unknown,
): ParsedGraphQlQuestionContent | null {
  if (!isObjectRecord(payload) || !isObjectRecord(payload.data)) {
    return null
  }

  const question = payload.data.question

  if (!isObjectRecord(question)) {
    return null
  }

  return {
    contentHtml: readTrimmedString(question.content),
    hints: readStringList(question.hints),
  }
}

function createContentDocumentOrNull(
  contentHtml: string,
  documentRef: Document | undefined,
) {
  const hostDocument = readAvailableDocument(documentRef)

  if (!hostDocument) {
    return null
  }

  const contentDocument = hostDocument.implementation.createHTMLDocument('')
  const fragment = DOMPurify.sanitize(contentHtml, {
    RETURN_DOM_FRAGMENT: true,
    RETURN_DOM: true,
  }) as DocumentFragment
  contentDocument.body.appendChild(fragment)

  return contentDocument
}

function readContentPartsFromRoot(contentRoot: ParentNode) {
  const normalizedText = readNormalizedText(contentRoot)

  return {
    statement: readStatementFromText(normalizedText),
    examples: readExamplesFromRoot(contentRoot),
    constraints: readConstraintsFromRoot(contentRoot, normalizedText),
  }
}

function readContentPartsFromText(text: string) {
  return {
    statement: readStatementFromText(text),
    examples: Array.from(
      text.matchAll(
        /\bExample\s+(\d+)\s*:\s*([\s\S]*?)(?=\bExample\s+\d+\s*:|\bConstraints\s*:|$)/gi,
      ),
    )
      .map((match) => readExampleFromText(match[0], Number(match[1]) - 1))
      .filter((example): example is LeetCodeExample => Boolean(example)),
    constraints: readConstraintsFromText(text),
  }
}

function readStatementFromText(text: string) {
  return stripLeetCodeNoise(
    text.split(/\bExample\s+\d+\s*:|\bConstraints\s*:|\bFollow-up\s*:/i)[0] ??
      '',
  )
}

function readExamplesFromRoot(contentRoot: ParentNode): LeetCodeExample[] {
  const examplesFromPreBlocks = Array.from(contentRoot.querySelectorAll('pre'))
    .map((preElement, index) =>
      readExampleFromText(readMultilineText(preElement), index),
    )
    .filter((example): example is LeetCodeExample => Boolean(example))

  if (examplesFromPreBlocks.length > 0) {
    return examplesFromPreBlocks
  }

  return Array.from(
    readNormalizedText(contentRoot).matchAll(
      /\bExample\s+(\d+)\s*:\s*([\s\S]*?)(?=\bExample\s+\d+\s*:|\bConstraints\s*:|$)/gi,
    ),
  )
    .map((match) => readExampleFromText(match[0], Number(match[1]) - 1))
    .filter((example): example is LeetCodeExample => Boolean(example))
}

function readExampleFromText(text: string, index: number) {
  const rawText = text.trim()

  if (!rawText || !/\bInput\s*:/i.test(rawText)) {
    return null
  }

  const label =
    rawText.match(/\bExample\s+\d+\s*:/i)?.[0].replace(/:$/, '') ??
    `Example ${index + 1}`

  return {
    label,
    input: readExampleField(rawText, 'Input', [
      'Output',
      'Explanation',
      'Constraints',
      'Example',
    ]),
    output: readExampleField(rawText, 'Output', [
      'Explanation',
      'Constraints',
      'Example',
    ]),
    explanation: readExampleField(rawText, 'Explanation', [
      'Constraints',
      'Example',
    ]),
    rawText,
  } satisfies LeetCodeExample
}

function readExampleField(
  text: string,
  label: string,
  stopLabels: readonly string[],
) {
  const stopPattern = stopLabels.map(escapeRegExp).join('|')
  const fieldPattern = new RegExp(
    `\\b${escapeRegExp(label)}\\s*:\\s*([\\s\\S]*?)(?=\\b(?:${stopPattern})\\s*:|$)`,
    'i',
  )
  const fieldValue = text.match(fieldPattern)?.[1]?.trim()

  return fieldValue || null
}

function readConstraintsFromRoot(
  contentRoot: ParentNode,
  normalizedText: string,
) {
  const constraintsHeading = Array.from(
    contentRoot.querySelectorAll('p, div, h1, h2, h3, h4, strong'),
  ).find((candidateElement) =>
    /^Constraints\s*:?\s*$/i.test(readNormalizedText(candidateElement)),
  )
  const constraintsList = constraintsHeading
    ? findNextListElement(constraintsHeading)
    : null
  const listConstraints = constraintsList
    ? Array.from(constraintsList.querySelectorAll('li'))
        .map((constraintElement) => readNormalizedText(constraintElement))
        .filter(Boolean)
    : []

  if (listConstraints.length > 0) {
    return uniqueStrings(listConstraints)
  }

  return readConstraintsFromText(normalizedText)
}

function readConstraintsFromText(text: string) {
  const constraintsText = text.match(
    /\bConstraints\s*:?\s*([\s\S]*?)(?=\bFollow-up\s*:|\bHint\s*\d*\s*:|$)/i,
  )?.[1]

  if (!constraintsText) {
    return []
  }

  return uniqueStrings(
    splitConstraintCandidates(constraintsText)
      .map(stripLeetCodeNoise)
      .filter(Boolean),
  )
}

function splitConstraintCandidates(constraintsText: string) {
  const lineCandidates = constraintsText
    .split(/\n+/)
    .map(stripLeetCodeNoise)
    .filter(Boolean)

  return lineCandidates.flatMap((lineCandidate) =>
    lineCandidate.split(
      /(?<=[.;])\s+(?=(?:-?\d+\s*<=|[a-zA-Z_][\w.]*\s*(?:==|<=|>=|<|>)))/,
    ),
  )
}

function findNextListElement(element: Element) {
  let nextElement = element.nextElementSibling

  while (nextElement) {
    if (nextElement.matches('ul, ol')) {
      return nextElement
    }

    if (readNormalizedText(nextElement)) {
      return null
    }

    nextElement = nextElement.nextElementSibling
  }

  return null
}

function readHintsFromDomRoot(contentRoot: ParentNode) {
  const hintTexts = Array.from(
    contentRoot.querySelectorAll(
      '[data-e2e-locator*="hint" i], [data-cy*="hint" i], [class*="hint" i], details',
    ),
  )
    .map((hintElement) =>
      stripLeetCodeNoise(
        readNormalizedText(hintElement).replace(/^Hint\s*\d*\s*:?\s*/i, ''),
      ),
    )
    .filter((hintText) => hintText && !/^hint\s*\d*$/i.test(hintText))

  return uniqueStrings(hintTexts)
}

function findProblemContentRoot(pageRoot: ParentNode) {
  for (const selector of leetCodeProblemContentRootSelectors) {
    const contentRoot = pageRoot.querySelector(selector)

    if (contentRoot) {
      return contentRoot
    }
  }

  return null
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(readTrimmedString)
    .map((text) =>
      text
        ? stripLeetCodeNoise(readTextFromHtml(DOMPurify.sanitize(text)))
        : null,
    )
    .filter((text): text is string => Boolean(text))
}

function readAvailableDocument(documentRef: Document | undefined) {
  if (documentRef) {
    return documentRef
  }

  return typeof document === 'undefined' ? null : document
}

function stripLeetCodeNoise(value: string) {
  return stripRepeatedWhitespace(value)
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values))
}
