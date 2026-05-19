import type {
  LeetCodeProblemLocation,
  LeetCodeSubmissionClick,
  LeetCodeSubmissionPollingDebug,
  LeetCodeSubmissionResult,
  LeetCodeSubmissionStatus,
  LeetCodeSubmittedCodeSnapshot,
} from '../domain/types'
import { normalizeLeetCodeLanguageLabel } from '../domain/language'

type LeetCodeSubmissionFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

type SubmissionListEntry = {
  id: string
  timestamp: number | null
  statusText: string | null
  runtime: string | null
  memory: string | null
  language: string | null
}

type SubmissionCheckPayload = {
  state: string | null
  isFinished: boolean | null
  statusCode: number | null
  statusText: string | null
  runtime: string | null
  memory: string | null
  passedTestCount: number | null
  totalTestCount: number | null
  compileError: string | null
  runtimeError: string | null
  lastTestcase: string | null
  codeOutput: string | null
  expectedOutput: string | null
  stdOutput: string | null
  errorMessage: string | null
  language: string | null
}

type SubmissionDetailsPayload = {
  statusCode: number | null
  statusText: string | null
  runtime: string | null
  memory: string | null
  passedTestCount: number | null
  totalTestCount: number | null
  compileError: string | null
  runtimeError: string | null
  lastTestcase: string | null
  codeOutput: string | null
  expectedOutput: string | null
  stdOutput: string | null
  errorMessage: string | null
  code: string | null
  language: string | null
}

const leetCodeSubmissionDetailsQuery = `
  query submissionDetails($submissionId: Int!) {
    submissionDetails(submissionId: $submissionId) {
      id
      runtime
      runtimeDisplay
      memory
      memoryDisplay
      code
      statusCode
      statusDisplay
      totalCorrect
      totalTestcases
      runtimeError
      compileError
      lastTestcase
      codeOutput
      expectedOutput
      stdOutput
      lang {
        name
        verboseName
      }
    }
  }
`

export async function readLeetCodeSubmissionResultFromApi(options: {
  location: LeetCodeProblemLocation
  click: LeetCodeSubmissionClick
  submittedCodeSnapshot: LeetCodeSubmittedCodeSnapshot
  fetch?: LeetCodeSubmissionFetch | undefined
  document?: Document | undefined
  now?: (() => number) | undefined
  onDebug?: ((debug: LeetCodeSubmissionPollingDebug) => void) | undefined
}): Promise<LeetCodeSubmissionResult | null> {
  const fetchLeetCode = options.fetch ?? globalThis.fetch?.bind(globalThis)

  if (!fetchLeetCode) {
    return null
  }

  emitSubmissionPollingDebug(options, {
    phase: 'finding-submission',
    submissionId: null,
    checkState: null,
    statusText: null,
  })

  const submissionListEntry = await findSubmissionListEntryForClick({
    location: options.location,
    click: options.click,
    fetch: fetchLeetCode,
  })

  if (!submissionListEntry) {
    emitSubmissionPollingDebug(options, {
      phase: 'submission-not-found',
      submissionId: null,
      checkState: null,
      statusText: 'No matching submission found',
    })
    return null
  }

  emitSubmissionPollingDebug(options, {
    phase: 'submission-found',
    submissionId: submissionListEntry.id,
    checkState: null,
    statusText: submissionListEntry.statusText,
  })

  const checkPayload = await readSubmissionCheckPayload({
    location: options.location,
    submissionId: submissionListEntry.id,
    fetch: fetchLeetCode,
  })

  emitSubmissionPollingDebug(options, {
    phase: 'checking-result',
    submissionId: submissionListEntry.id,
    checkState: checkPayload?.state ?? null,
    statusText: checkPayload?.statusText ?? 'Submission check unavailable',
  })

  if (!checkPayload || !isTerminalSubmissionCheck(checkPayload)) {
    return null
  }

  emitSubmissionPollingDebug(options, {
    phase: 'api-result-found',
    submissionId: submissionListEntry.id,
    checkState: checkPayload.state,
    statusText:
      checkPayload.statusText ?? submissionListEntry.statusText ?? 'Unknown',
  })

  const detailsPayload = await readSubmissionDetailsPayload({
    location: options.location,
    submissionId: submissionListEntry.id,
    fetch: fetchLeetCode,
    document: options.document,
  })
  const graphQlDetailsStatusText =
    detailsPayload?.statusText ??
    checkPayload.statusText ??
    submissionListEntry.statusText

  emitSubmissionPollingDebug(options, {
    phase: detailsPayload ? 'graphql-details-found' : 'graphql-details-missing',
    submissionId: submissionListEntry.id,
    checkState: checkPayload.state,
    statusText: graphQlDetailsStatusText ?? 'Unknown',
  })

  const statusText =
    detailsPayload?.statusText ??
    checkPayload.statusText ??
    submissionListEntry.statusText ??
    'Unknown'
  const status = normalizeLeetCodeSubmissionStatus(
    detailsPayload?.statusCode ?? checkPayload.statusCode,
    statusText,
  )
  const code = detailsPayload?.code ?? options.submittedCodeSnapshot.code
  const language =
    detailsPayload?.language ??
    checkPayload.language ??
    submissionListEntry.language ??
    options.submittedCodeSnapshot.language
  const capturedAt = options.now?.() ?? Date.now()
  const compileError =
    status === 'accepted'
      ? null
      : (detailsPayload?.compileError ?? checkPayload.compileError)
  const runtimeError =
    status === 'accepted'
      ? null
      : (detailsPayload?.runtimeError ?? checkPayload.runtimeError)
  const lastTestcase =
    status === 'accepted'
      ? null
      : (detailsPayload?.lastTestcase ?? checkPayload.lastTestcase)
  const codeOutput =
    status === 'accepted'
      ? null
      : (detailsPayload?.codeOutput ?? checkPayload.codeOutput)
  const expectedOutput =
    status === 'accepted'
      ? null
      : (detailsPayload?.expectedOutput ?? checkPayload.expectedOutput)
  const stdOutput = detailsPayload?.stdOutput ?? checkPayload.stdOutput
  const errorMessage =
    status === 'accepted'
      ? null
      : (runtimeError ??
        compileError ??
        detailsPayload?.errorMessage ??
        checkPayload.errorMessage)

  return {
    location: options.location,
    submissionId: submissionListEntry.id,
    source: 'api',
    status,
    statusText,
    checkedAt: capturedAt,
    runtime:
      detailsPayload?.runtime ??
      checkPayload.runtime ??
      submissionListEntry.runtime,
    memory:
      detailsPayload?.memory ??
      checkPayload.memory ??
      submissionListEntry.memory,
    passedTestCount:
      detailsPayload?.passedTestCount ?? checkPayload.passedTestCount,
    totalTestCount:
      detailsPayload?.totalTestCount ?? checkPayload.totalTestCount,
    failingTestcase: lastTestcase,
    errorMessage,
    compileError,
    runtimeError,
    lastTestcase,
    codeOutput,
    expectedOutput,
    stdOutput,
    resultCodeSnapshot: {
      code,
      language,
      source: detailsPayload?.code
        ? 'api'
        : options.submittedCodeSnapshot.source,
      capturedAt,
    },
  }
}

function emitSubmissionPollingDebug(
  options: {
    now?: (() => number) | undefined
    onDebug?: ((debug: LeetCodeSubmissionPollingDebug) => void) | undefined
  },
  debug: Omit<LeetCodeSubmissionPollingDebug, 'checkedAt'>,
) {
  options.onDebug?.({
    ...debug,
    checkedAt: options.now?.() ?? Date.now(),
  })
}

async function findSubmissionListEntryForClick(options: {
  location: LeetCodeProblemLocation
  click: LeetCodeSubmissionClick
  fetch: LeetCodeSubmissionFetch
}) {
  const submissionListUrl = new URL(
    `/api/submissions/${options.location.slug}/`,
    options.location.url,
  )
  submissionListUrl.searchParams.set('offset', '0')
  submissionListUrl.searchParams.set('limit', '5')

  const response = await options.fetch(submissionListUrl, {
    credentials: 'include',
  })

  if (!response.ok) {
    return null
  }

  const payload: unknown = await response.json()
  const submissions = readSubmissionListEntries(payload)
  const clickedAtSeconds = Math.floor(options.click.clickedAt / 1000)

  return (
    submissions.find(
      (submission) =>
        submission.timestamp !== null &&
        submission.timestamp >= clickedAtSeconds - 5 &&
        submission.statusText !== 'Internal Error',
    ) ?? null
  )
}

async function readSubmissionCheckPayload(options: {
  location: LeetCodeProblemLocation
  submissionId: string
  fetch: LeetCodeSubmissionFetch
}): Promise<SubmissionCheckPayload | null> {
  const checkUrl = new URL(
    `/submissions/detail/${options.submissionId}/check/`,
    options.location.url,
  )
  const response = await options.fetch(checkUrl, {
    credentials: 'include',
  })

  if (!response.ok) {
    return null
  }

  const payload: unknown = await response.json()

  if (!isObjectRecord(payload)) {
    return null
  }

  return {
    state: readTrimmedString(payload.state),
    isFinished: readBoolean(payload.finished ?? payload.is_finished),
    statusCode: readNumber(payload.status_code ?? payload.statusCode),
    statusText: readTrimmedString(payload.status_msg ?? payload.statusMsg),
    runtime: readTrimmedString(payload.status_runtime ?? payload.runtime),
    memory: readTrimmedString(payload.status_memory ?? payload.memory),
    passedTestCount: readNumber(payload.total_correct ?? payload.totalCorrect),
    totalTestCount: readNumber(
      payload.total_testcases ?? payload.totalTestcases,
    ),
    compileError: readTrimmedString(payload.compile_error),
    runtimeError: readTrimmedString(
      payload.runtime_error ?? payload.full_runtime_error,
    ),
    lastTestcase: readTrimmedString(
      payload.last_testcase ??
        payload.lastTestcase ??
        payload.input_formatted ??
        payload.input,
    ),
    codeOutput: readTrimmedString(
      payload.code_output ?? payload.codeOutput ?? payload.output,
    ),
    expectedOutput: readTrimmedString(
      payload.expected_output ??
        payload.expectedOutput ??
        payload.expected_code_answer ??
        payload.expectedCodeAnswer,
    ),
    stdOutput: readTrimmedString(
      payload.std_output ??
        payload.stdOutput ??
        payload.stdout ??
        payload.standard_output,
    ),
    errorMessage: readTrimmedString(
      payload.runtime_error ??
        payload.compile_error ??
        payload.full_runtime_error ??
        payload.status_msg,
    ),
    language: readLanguageLabel(payload.pretty_lang ?? payload.lang),
  }
}

async function readSubmissionDetailsPayload(options: {
  location: LeetCodeProblemLocation
  submissionId: string
  fetch: LeetCodeSubmissionFetch
  document?: Document | undefined
}): Promise<SubmissionDetailsPayload | null> {
  const submissionIdNumber = Number(options.submissionId)

  if (!Number.isFinite(submissionIdNumber)) {
    return null
  }

  const response = await options.fetch(
    new URL('/graphql', options.location.url),
    {
      method: 'POST',
      credentials: 'include',
      headers: createLeetCodeGraphQlHeaders(options.document),
      body: JSON.stringify({
        query: leetCodeSubmissionDetailsQuery,
        variables: { submissionId: submissionIdNumber },
        operationName: 'submissionDetails',
      }),
    },
  )

  if (!response.ok) {
    return null
  }

  const payload: unknown = await response.json()

  if (!isObjectRecord(payload) || !isObjectRecord(payload.data)) {
    return null
  }

  const details = payload.data.submissionDetails

  if (!isObjectRecord(details)) {
    return null
  }

  const language = isObjectRecord(details.lang)
    ? (readLanguageLabel(details.lang.verboseName) ??
      readLanguageLabel(details.lang.name))
    : null

  return {
    statusCode: readNumber(details.statusCode),
    statusText: readTrimmedString(details.statusDisplay),
    runtime:
      readTrimmedString(details.runtimeDisplay) ??
      readTrimmedString(details.runtime),
    memory:
      readTrimmedString(details.memoryDisplay) ??
      readTrimmedString(details.memory),
    passedTestCount: readNumber(details.totalCorrect),
    totalTestCount: readNumber(details.totalTestcases),
    compileError: readTrimmedString(details.compileError),
    runtimeError: readTrimmedString(details.runtimeError),
    lastTestcase: readTrimmedString(details.lastTestcase),
    codeOutput: readTrimmedString(details.codeOutput),
    expectedOutput: readTrimmedString(details.expectedOutput),
    stdOutput: readTrimmedString(details.stdOutput),
    errorMessage: readTrimmedString(
      details.runtimeError ?? details.compileError,
    ),
    code: readTrimmedString(details.code),
    language,
  }
}

function readSubmissionListEntries(payload: unknown): SubmissionListEntry[] {
  if (!isObjectRecord(payload)) {
    return []
  }

  const submissionsValue = payload.submission_list ?? payload.submissions_dump

  if (!Array.isArray(submissionsValue)) {
    return []
  }

  return submissionsValue
    .map((submissionValue): SubmissionListEntry | null => {
      if (!isObjectRecord(submissionValue)) {
        return null
      }

      const id = readSubmissionId(submissionValue.id)

      if (!id) {
        return null
      }

      return {
        id,
        timestamp: readNumber(submissionValue.timestamp),
        statusText: readTrimmedString(
          submissionValue.status_display ?? submissionValue.statusDisplay,
        ),
        runtime: readTrimmedString(submissionValue.runtime),
        memory: readTrimmedString(submissionValue.memory),
        language: readLanguageLabel(
          submissionValue.lang_name ??
            submissionValue.langName ??
            submissionValue.lang,
        ),
      }
    })
    .filter((submission): submission is SubmissionListEntry =>
      Boolean(submission),
    )
}

function isTerminalSubmissionCheck(checkPayload: SubmissionCheckPayload) {
  return (
    checkPayload.state === 'SUCCESS' ||
    checkPayload.isFinished === true ||
    (checkPayload.state === null &&
      Boolean(checkPayload.statusText && checkPayload.statusText !== 'Pending'))
  )
}

function normalizeLeetCodeSubmissionStatus(
  statusCode: number | null,
  statusText: string,
): LeetCodeSubmissionStatus {
  if (statusCode === 10 || /\bAccepted\b/i.test(statusText)) {
    return 'accepted'
  }

  if (statusCode === 11 || /\bWrong Answer\b/i.test(statusText)) {
    return 'wrong-answer'
  }

  if (statusCode === 12 || /\bMemory Limit Exceeded\b/i.test(statusText)) {
    return 'memory-limit-exceeded'
  }

  if (statusCode === 13 || /\bOutput Limit Exceeded\b/i.test(statusText)) {
    return 'output-limit-exceeded'
  }

  if (statusCode === 14 || /\bTime Limit Exceeded\b/i.test(statusText)) {
    return 'time-limit-exceeded'
  }

  if (statusCode === 15 || /\bRuntime Error\b/i.test(statusText)) {
    return 'runtime-error'
  }

  if (statusCode === 20 || /\bCompile Error\b/i.test(statusText)) {
    return 'compile-error'
  }

  return 'unknown'
}

function createLeetCodeGraphQlHeaders(documentRef: Document | undefined) {
  const graphQlHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const csrfToken = documentRef
    ? readCookieValue(documentRef.cookie, 'csrftoken')
    : null

  if (csrfToken) {
    graphQlHeaders['x-csrftoken'] = csrfToken
  }

  return graphQlHeaders
}

function readCookieValue(cookieHeader: string, cookieName: string) {
  return (
    cookieHeader
      .split(';')
      .map((cookiePart) => cookiePart.trim())
      .find((cookiePart) => cookiePart.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1) ?? null
  )
}

function readTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readLanguageLabel(value: unknown) {
  return typeof value === 'string'
    ? normalizeLeetCodeLanguageLabel(value)
    : null
}

function readSubmissionId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return readTrimmedString(value)
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : null
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
