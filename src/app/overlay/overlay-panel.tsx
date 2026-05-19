import {
  Activity,
  BookOpenText,
  CheckCircle2,
  Clock3,
  Code2,
  FileCode2,
  LockKeyhole,
  Send,
  Sparkles,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { reviewRatings, type ReviewRating } from '@/lib/fsrs'

import type { LeetCodeOverlaySession } from './use-leetcode-overlay-session'

type OverlayPanelProps = LeetCodeOverlaySession

const ratingLabels = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
} as const satisfies Record<ReviewRating, string>

export function OverlayPanel({
  codeSnapshot,
  context,
  elapsedSeconds,
  feedback,
  lastSubmissionClick,
  lastSubmissionAttempt,
  lastSubmissionPollingDebug,
  lastSubmissionResult,
  location,
  metadata,
  problemContent,
  saveReview,
  status,
}: OverlayPanelProps) {
  const isSaving = status === 'saving-review'
  const canSave = Boolean(context?.problem) && !isSaving
  const problemTitle =
    metadata?.title ?? context?.problem.title ?? location?.slug
  const topics = metadata?.topics ?? []
  const isPremiumProblem = metadata?.isPremium === true
  const isWaitingForSubmissionResult = Boolean(
    lastSubmissionAttempt && !lastSubmissionResult,
  )

  return (
    <aside className="cp-overlay-host cp-stack p-3" aria-label="CogniPace">
      <div className="cp-row">
        <div className="min-w-0">
          <p className="cp-kicker">CogniPace</p>
          <h1 className="cp-title truncate">
            {problemTitle ?? 'Reading page'}
          </h1>
        </div>
        <Badge>{metadata?.difficulty ?? 'Unknown'}</Badge>
      </div>

      <div className="cp-overlay-timer">
        <Clock3 size={16} aria-hidden="true" />
        <span>{formatElapsedTime(elapsedSeconds)}</span>
      </div>

      <div className="cp-overlay-meta">
        <Badge>{location?.slug ?? 'No problem'}</Badge>
        <Badge>{metadata?.source ?? 'waiting'}</Badge>
        {isPremiumProblem ? <Badge>Premium</Badge> : null}
        {context?.practiceStatus ? (
          <Badge>{context.practiceStatus}</Badge>
        ) : null}
      </div>

      {topics.length > 0 ? (
        <div className="cp-overlay-topic-list" aria-label="LeetCode topics">
          {topics.slice(0, 4).map((topic) => (
            <Badge key={topic.slug ?? topic.name}>{topic.name}</Badge>
          ))}
        </div>
      ) : null}

      <div className="cp-overlay-signal-grid">
        <div className="cp-overlay-signal">
          <Sparkles size={14} aria-hidden="true" />
          <span>{metadata?.confidence ?? 'low'} confidence</span>
        </div>
        <div className="cp-overlay-signal">
          <Code2 size={14} aria-hidden="true" />
          <span>
            {codeSnapshot?.language ?? codeSnapshot?.source ?? 'no code'}
          </span>
        </div>
      </div>

      {isPremiumProblem ? (
        <div className="cp-overlay-feedback">
          <LockKeyhole size={14} aria-hidden="true" />
          <span>Premium locked on LeetCode</span>
        </div>
      ) : null}

      {lastSubmissionClick ? (
        <div className="cp-overlay-feedback">
          <Send size={14} aria-hidden="true" />
          <span>
            Submit click seen at{' '}
            {formatClockTime(lastSubmissionClick.clickedAt)}
          </span>
        </div>
      ) : null}

      {problemContent ? (
        <section
          className="cp-overlay-debug"
          aria-label="Problem content debug"
        >
          <div className="cp-overlay-debug-heading">
            <BookOpenText size={14} aria-hidden="true" />
            <span>Problem content</span>
          </div>
          <div className="cp-overlay-debug-grid">
            <span>source</span>
            <strong>{problemContent.source}</strong>
            <span>confidence</span>
            <strong>{problemContent.confidence}</strong>
            <span>examples</span>
            <strong>{problemContent.examples.length}</strong>
            <span>constraints</span>
            <strong>{problemContent.constraints.length}</strong>
            <span>hints</span>
            <strong>{problemContent.hints.length}</strong>
            <span>fingerprint</span>
            <strong>
              {formatShortFingerprint(problemContent.contentFingerprint)}
            </strong>
          </div>
          <pre className="cp-overlay-code-preview">
            {formatProblemContentPreview(problemContent.statement)}
          </pre>
          {problemContent.examples[0] ? (
            <pre className="cp-overlay-code-preview">
              {formatProblemContentPreview(problemContent.examples[0].rawText)}
            </pre>
          ) : null}
          {problemContent.constraints.length > 0 ? (
            <pre className="cp-overlay-code-preview">
              {formatListPreview(problemContent.constraints)}
            </pre>
          ) : null}
        </section>
      ) : null}

      {lastSubmissionAttempt ? (
        <section
          className="cp-overlay-debug"
          aria-label="Submission attempt debug"
        >
          <div className="cp-overlay-debug-heading">
            <FileCode2 size={14} aria-hidden="true" />
            <span>Submitted snapshot</span>
          </div>
          <div className="cp-overlay-debug-grid">
            <span>language</span>
            <strong>
              {lastSubmissionAttempt.submittedCodeSnapshot.language ??
                'unknown'}
            </strong>
            <span>source</span>
            <strong>
              {lastSubmissionAttempt.submittedCodeSnapshot.source}
            </strong>
            <span>lines</span>
            <strong>
              {countCodeLines(lastSubmissionAttempt.submittedCodeSnapshot.code)}
            </strong>
            <span>captured</span>
            <strong>{formatClockTime(lastSubmissionAttempt.clickedAt)}</strong>
          </div>
          <pre className="cp-overlay-code-preview">
            {formatCodePreview(
              lastSubmissionAttempt.submittedCodeSnapshot.code,
            )}
          </pre>
        </section>
      ) : null}

      {isWaitingForSubmissionResult ? (
        <section
          className="cp-overlay-debug"
          aria-label="Submission result pending"
        >
          <div className="cp-overlay-debug-heading">
            <Activity size={14} aria-hidden="true" />
            <span>Waiting for result</span>
          </div>
          <div className="cp-overlay-debug-status">
            Watching LeetCode submission APIs
          </div>
        </section>
      ) : null}

      {lastSubmissionPollingDebug ? (
        <section
          className="cp-overlay-debug"
          aria-label="Submission polling debug"
        >
          <div className="cp-overlay-debug-heading">
            <Activity size={14} aria-hidden="true" />
            <span>Polling debug</span>
          </div>
          <div className="cp-overlay-debug-status">
            {formatSubmissionPollingPhase(lastSubmissionPollingDebug.phase)}
          </div>
          <div className="cp-overlay-debug-grid">
            <span>id</span>
            <strong>
              {formatNullableValue(lastSubmissionPollingDebug.submissionId)}
            </strong>
            <span>check</span>
            <strong>
              {formatNullableValue(lastSubmissionPollingDebug.checkState)}
            </strong>
            <span>status</span>
            <strong>
              {formatNullableValue(lastSubmissionPollingDebug.statusText)}
            </strong>
            <span>checked</span>
            <strong>
              {formatClockTime(lastSubmissionPollingDebug.checkedAt)}
            </strong>
          </div>
        </section>
      ) : null}

      {lastSubmissionResult ? (
        <section
          className="cp-overlay-debug"
          aria-label="Submission result debug"
        >
          <div className="cp-overlay-debug-heading">
            <Activity size={14} aria-hidden="true" />
            <span>Submission result</span>
          </div>
          <div className="cp-overlay-debug-status">
            {lastSubmissionResult.statusText}
          </div>
          <div className="cp-overlay-debug-grid">
            <span>source</span>
            <strong>{lastSubmissionResult.source}</strong>
            <span>runtime</span>
            <strong>{formatNullableValue(lastSubmissionResult.runtime)}</strong>
            <span>memory</span>
            <strong>{formatNullableValue(lastSubmissionResult.memory)}</strong>
            <span>tests</span>
            <strong>{formatTestProgress(lastSubmissionResult)}</strong>
            <span>id</span>
            <strong>
              {formatNullableValue(lastSubmissionResult.submissionId)}
            </strong>
            <span>checked</span>
            <strong>{formatClockTime(lastSubmissionResult.checkedAt)}</strong>
            <span>code source</span>
            <strong>{lastSubmissionResult.resultCodeSnapshot.source}</strong>
          </div>
          {lastSubmissionResult.failingTestcase ? (
            <pre className="cp-overlay-code-preview">
              {lastSubmissionResult.failingTestcase}
            </pre>
          ) : null}
          <pre className="cp-overlay-code-preview">
            {formatCodePreview(lastSubmissionResult.resultCodeSnapshot.code)}
          </pre>
        </section>
      ) : null}

      {feedback ? (
        <div className="cp-overlay-feedback" role="status">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      ) : null}

      <div className="cp-overlay-rating-grid" aria-label="Save review result">
        {reviewRatings.map((rating) => (
          <Button
            key={rating}
            disabled={!canSave}
            onClick={() => void saveReview(rating)}
            size="sm"
            type="button"
            variant={rating === 'again' ? 'outline' : 'primary'}
          >
            {ratingLabels[rating]}
          </Button>
        ))}
      </div>
    </aside>
  )
}

function formatElapsedTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatClockTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatNullableValue(value: string | null) {
  return value ?? 'unknown'
}

function formatSubmissionPollingPhase(phase: string) {
  return phase.replaceAll('-', ' ')
}

function formatTestProgress(result: {
  passedTestCount: number | null
  totalTestCount: number | null
}) {
  if (result.passedTestCount === null || result.totalTestCount === null) {
    return 'unknown'
  }

  return `${result.passedTestCount}/${result.totalTestCount}`
}

function countCodeLines(code: string | null) {
  return code ? code.split('\n').length : 0
}

function formatCodePreview(code: string | null) {
  if (!code) {
    return 'No submitted code captured.'
  }

  const previewLines = code.split('\n').slice(0, 6)
  const hasMoreLines = code.split('\n').length > previewLines.length

  return `${previewLines.join('\n')}${hasMoreLines ? '\n...' : ''}`
}

function formatProblemContentPreview(value: string) {
  if (!value) {
    return 'No content captured.'
  }

  return value.length > 220 ? `${value.slice(0, 220).trim()}...` : value
}

function formatListPreview(values: readonly string[]) {
  return values.slice(0, 4).join('\n')
}

function formatShortFingerprint(fingerprint: string) {
  return fingerprint.replace(/^lc-content-/, '')
}
