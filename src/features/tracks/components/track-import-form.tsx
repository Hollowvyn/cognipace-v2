import { Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import {
  createTrackImportPreview,
  trackImportFileSchema,
  trackImportSchemaVersion,
  type TrackImportFile,
  type TrackImportPreview,
} from '../api/tracks-contracts'
import { useImportTracks } from '../api/tracks-api'

export function TrackImportForm({
  onCancel,
  onDone,
}: {
  onCancel: () => void
  onDone: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importTracks = useImportTracks()
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<TrackImportFile | null>(null)
  const [preview, setPreview] = useState<TrackImportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const isPending = importTracks.isPending

  async function handleFileSelect(file: File) {
    setSelectedFileName(file.name)
    setSelectedFile(null)
    setPreview(null)
    setError(null)
    setSuccess(null)

    let parsedJson: unknown

    try {
      parsedJson = JSON.parse(await readFileText(file))
    } catch {
      setError('Selected file is not valid JSON.')
      return
    }

    if (hasWrongTrackImportApp(parsedJson)) {
      setError('Selected file is not a CogniPace track import.')
      return
    }

    const parsedFile = trackImportFileSchema.safeParse(parsedJson)

    if (!parsedFile.success) {
      setError(
        formatUnsupportedSchemaVersion(parsedJson) ??
          formatImportValidationError(parsedFile.error),
      )
      return
    }

    setSelectedFile(parsedFile.data)
    setPreview(createTrackImportPreview(parsedFile.data))
  }

  async function handleImport() {
    if (!selectedFile || isPending || success) {
      return
    }

    setError(null)

    try {
      const result = await importTracks.mutateAsync({
        surface: 'dashboard',
        file: selectedFile,
      })
      setSuccess(
        `Imported ${result.createdTrackCount} ${result.createdTrackCount === 1 ? 'track' : 'tracks'}. Created ${result.createdProblemCount} problems. Reused ${result.reusedProblemCount} problems.`,
      )
    } catch (caughtError) {
      setError(readErrorMessage(caughtError, 'Track import failed.'))
    }
  }

  const controlsDisabled = isPending

  return (
    <div className="grid gap-[var(--cp-surface-gap)] pb-[var(--cp-panel-padding)]">
      {!selectedFile ? (
        <Surface className="grid gap-3" variant="inset">
          <div className="grid gap-1">
            <h2 className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
              Import tracks from JSON
            </h2>
            <p className="m-0 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
              Existing problems are reused, and missing problems are created
              from the import file.
            </p>
          </div>
          <details className="grid gap-2 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
            <summary className="cursor-pointer font-semibold text-foreground">
              Recommended JSON shape
            </summary>
            <p className="m-0">
              Use the strict envelope literals <code>schemaVersion: 1</code> and{' '}
              <code>app: &quot;cognipace-track-import&quot;</code>. Define each
              problem once in top-level <code>problems</code>, then list
              <code>tracks</code> with <code>groups</code> and canonical
              LeetCode <code>problemSlugs</code> references.
            </p>
            <p className="m-0">
              Omitted track descriptions and dates default to <code>null</code>;
              problem difficulty defaults to <code>&quot;unknown&quot;</code>{' '}
              and <code>isPremium</code> to <code>false</code>. The contract is
              strict: use up to 20 tracks, 5,000 problems, 100 groups per track,
              1,000 slugs per group, and 1,000 problem memberships per track.
              Extra fields are rejected.
            </p>
          </details>
        </Surface>
      ) : null}

      <div className="grid gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2">
          <input
            accept="application/json,.json"
            aria-describedby="tracks-import-file-status"
            aria-label="Tracks import file"
            className="sr-only"
            disabled={controlsDisabled}
            id="tracks-import-file"
            onChange={handleFileChange(handleFileSelect)}
            ref={fileInputRef}
            type="file"
          />
          <Button
            disabled={controlsDisabled}
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            variant="outline"
          >
            {isPending ? (
              <Loader2
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Upload aria-hidden="true" />
            )}
            Choose JSON file
          </Button>
          <p
            className="m-0 min-w-0 flex-1 truncate text-[length:var(--cp-copy-font-size)] text-muted-foreground"
            id="tracks-import-file-status"
          >
            {selectedFileName ?? 'No Tracks import file selected'}
          </p>
        </div>
      </div>

      {error ? (
        <InlineStatus role="alert" tone="danger">
          {error}
        </InlineStatus>
      ) : null}

      {selectedFile && preview ? (
        <TrackImportReadyState
          disabled={isPending || Boolean(success)}
          onImport={() => {
            void handleImport()
          }}
          preview={preview}
        />
      ) : null}

      {isPending ? <InlineStatus>Importing tracks…</InlineStatus> : null}
      {success ? <InlineStatus tone="success">{success}</InlineStatus> : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {success ? (
          <Button onClick={onDone}>Done</Button>
        ) : (
          <Button disabled={isPending} onClick={onCancel} variant="outline">
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}

function TrackImportReadyState({
  disabled,
  onImport,
  preview,
}: {
  disabled: boolean
  onImport: () => void
  preview: TrackImportPreview
}) {
  return (
    <Surface className="grid gap-3" variant="inset">
      <div className="grid gap-1">
        <h2 className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
          Import preview
        </h2>
        <p className="m-0 text-[length:var(--cp-copy-font-size)] text-muted-foreground">
          Review the tracks, groups, and unique referenced problems before
          importing.
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-2 text-[length:var(--cp-copy-font-size)] sm:grid-cols-3">
        <PreviewMetric label="Tracks" value={preview.trackCount} />
        <PreviewMetric label="Groups" value={preview.groupCount} />
        <PreviewMetric
          label="Unique referenced problems"
          value={preview.uniqueProblemCount}
        />
      </dl>
      <div>
        <Button disabled={disabled} onClick={onImport} size="sm">
          {disabled ? null : <Upload aria-hidden="true" />}
          Import Tracks
        </Button>
      </div>
    </Surface>
  )
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--cp-radius-md)] border border-border bg-background px-3 py-2">
      <dt className="sr-only">{label}</dt>
      <dd className="m-0 font-semibold tabular-nums">
        {label}: {value}
      </dd>
    </div>
  )
}

function handleFileChange(onFileSelect: (file: File) => Promise<void>) {
  return (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (file) {
      void onFileSelect(file)
    }
  }
}

async function readFileText(file: File) {
  if ('text' in file && typeof file.text === 'function') {
    return file.text()
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Failed to read Tracks import file.'))
    })
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Failed to read Tracks import file.'))
    })
    reader.readAsText(file)
  })
}

function hasWrongTrackImportApp(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'app' in value &&
    value.app !== 'cognipace-track-import'
  )
}

function formatUnsupportedSchemaVersion(value: unknown): string | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    typeof value.schemaVersion !== 'number' ||
    value.schemaVersion === trackImportSchemaVersion
  ) {
    return null
  }

  return `Unsupported track import schema version ${value.schemaVersion}. Supported version: ${trackImportSchemaVersion}.`
}

function formatImportValidationError(error: { issues: readonly ZodIssue[] }) {
  const issue = error.issues[0]

  if (!issue) {
    return 'Tracks import validation failed.'
  }

  const path = issue.path.length > 0 ? issue.path.join('.') : 'file'
  return `Import file error at ${path}: ${issue.message}`
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

interface ZodIssue {
  message: string
  path: PropertyKey[]
}
