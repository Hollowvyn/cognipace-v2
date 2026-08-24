import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import type {
  TrackImportFile,
  TrackImportResult,
} from '../api/tracks-contracts'
import { TrackImportForm } from './track-import-form'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('TrackImportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('explains the import shape in accessible details and offers a JSON picker before a file is chosen', async () => {
    const user = userEvent.setup()
    renderImportForm()

    expect(screen.getByText(/existing problems are reused/i)).toBeVisible()
    expect(screen.getByText(/missing problems are created/i)).toBeVisible()
    const summary = screen.getByText('Recommended JSON shape')
    const details = summary.closest('details')

    expect(details).toBeInTheDocument()
    expect(details).not.toHaveAttribute('open')
    expect(summary.tagName).toBe('SUMMARY')

    await user.click(summary)

    expect(details).toBeVisible()
    expect(details).toHaveTextContent(
      /schemaVersion.*app.*top-level.*problems.*tracks.*groups.*problemSlugs/i,
    )
    expect(details).toHaveTextContent(
      /defaults.*unknown.*isPremium.*false.*strict.*20 tracks.*5,000 problems/i,
    )
    expect(screen.getByLabelText('Tracks import file')).toHaveAttribute(
      'accept',
      'application/json,.json',
    )
    expect(
      screen.getByRole('button', { name: 'Choose JSON file' }),
    ).toBeVisible()
  })

  it('reports invalid JSON without calling the import runtime', async () => {
    const user = userEvent.setup()
    renderImportForm()

    await user.upload(
      screen.getByLabelText('Tracks import file'),
      new File(['not json'], 'tracks.json', { type: 'application/json' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Selected file is not valid JSON.',
    )
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('rejects a file with the wrong Tracks import envelope', async () => {
    const user = userEvent.setup()
    renderImportForm()

    await user.upload(
      screen.getByLabelText('Tracks import file'),
      createJsonFile({
        app: 'cognipace-backup',
        schemaVersion: 1,
        tracks: [],
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Selected file is not a CogniPace track import.',
    )
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('reports the received and supported schema versions', async () => {
    const user = userEvent.setup()
    renderImportForm()

    await user.upload(
      screen.getByLabelText('Tracks import file'),
      createJsonFile({
        app: 'cognipace-track-import',
        schemaVersion: 2,
        tracks: [
          {
            title: 'Interview',
            groups: [{ title: 'Arrays', problemSlugs: ['two-sum'] }],
          },
        ],
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unsupported track import schema version 2. Supported version: 1.',
    )
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('shows the first useful contract path and message for invalid import data', async () => {
    const user = userEvent.setup()
    renderImportForm()

    await user.upload(
      screen.getByLabelText('Tracks import file'),
      createJsonFile({
        app: 'cognipace-track-import',
        schemaVersion: 1,
        tracks: [{ title: 'Interview', groups: [] }],
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /tracks\.0\.groups/i,
    )
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('shows approved preview counts and only enables import when the file is ready', async () => {
    const user = userEvent.setup()
    renderImportForm()

    await user.upload(
      screen.getByLabelText('Tracks import file'),
      createJsonFile({
        app: 'cognipace-track-import',
        schemaVersion: 1,
        problems: [{ slug: 'two-sum' }],
        tracks: [
          {
            title: 'Track One',
            groups: [
              { title: 'Arrays', problemSlugs: ['two-sum', 'binary-search'] },
              {
                title: 'Greedy',
                problemSlugs: ['maximum-subarray', 'container-with-most-water'],
              },
            ],
          },
          {
            title: 'Track Two',
            groups: [{ title: 'Review', problemSlugs: ['two-sum'] }],
          },
        ],
      }),
    )

    expect(await screen.findByText('Tracks: 2')).toBeVisible()
    expect(screen.getByText('Groups: 3')).toBeVisible()
    expect(screen.getByText('Unique referenced problems: 4')).toBeVisible()
    expect(screen.getByText('tracks.json')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Import Tracks' })).toBeEnabled()
  })

  it('keeps the newest file ready when an older file read resolves later', async () => {
    const user = userEvent.setup()
    const fileARead = createDeferred<string>()
    const fileBRead = createDeferred<string>()
    const importFileA = createImportFile('Track A', 'two-sum')
    const importFileB = createImportFile('Track B', 'binary-search', {
      trackCount: 2,
    })
    const fileA = createJsonFile(importFileA, 'tracks-a.json')
    const fileB = createJsonFile(importFileB, 'tracks-b.json')

    deferFileText(fileA, fileARead.promise)
    deferFileText(fileB, fileBRead.promise)
    renderImportForm()

    const input = screen.getByLabelText('Tracks import file')
    await user.upload(input, fileA)
    await user.upload(input, fileB)

    await act(async () => {
      fileBRead.resolve(JSON.stringify(importFileB))
      await fileBRead.promise
    })
    expect(await screen.findByText('Tracks: 2')).toBeVisible()

    await act(async () => {
      fileARead.resolve(JSON.stringify(importFileA))
      await fileARead.promise
    })

    expect(screen.getByText('tracks-b.json')).toBeVisible()
    expect(screen.getByText('Tracks: 2')).toBeVisible()
    expect(screen.getByText('Groups: 2')).toBeVisible()
    expect(screen.getByText('Unique referenced problems: 2')).toBeVisible()

    vi.mocked(sendMessage).mockResolvedValueOnce({
      createdTrackIds: ['track-b'],
      createdTrackCount: 2,
      createdProblemCount: 0,
      reusedProblemCount: 2,
    })
    await user.click(screen.getByRole('button', { name: 'Import Tracks' }))

    expect(sendMessage).toHaveBeenCalledWith('tracks.importTracks', {
      surface: 'dashboard',
      file: importFileB,
    })
  })

  it('keeps the newest file ready when an older file read rejects later', async () => {
    const user = userEvent.setup()
    const fileARead = createDeferred<string>()
    const fileBRead = createDeferred<string>()
    const importFileA = createImportFile('Track A', 'two-sum')
    const importFileB = createImportFile('Track B', 'binary-search', {
      trackCount: 2,
    })
    const fileA = createJsonFile(importFileA, 'tracks-a.json')
    const fileB = createJsonFile(importFileB, 'tracks-b.json')

    deferFileText(fileA, fileARead.promise)
    deferFileText(fileB, fileBRead.promise)
    renderImportForm()

    const input = screen.getByLabelText('Tracks import file')
    await user.upload(input, fileA)
    await user.upload(input, fileB)

    await act(async () => {
      fileBRead.resolve(JSON.stringify(importFileB))
      await fileBRead.promise
    })
    expect(await screen.findByText('Tracks: 2')).toBeVisible()

    await act(async () => {
      fileARead.reject(new Error('stale file read failed'))
      await fileARead.promise.catch(() => undefined)
    })

    expect(screen.getByText('tracks-b.json')).toBeVisible()
    expect(screen.getByText('Tracks: 2')).toBeVisible()
    expect(screen.getByText('Groups: 2')).toBeVisible()
    expect(screen.getByText('Unique referenced problems: 2')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Import Tracks' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disables duplicate submissions while the import is pending', async () => {
    const user = userEvent.setup()
    let resolveImport!: (
      value: TrackImportResult | PromiseLike<TrackImportResult>,
    ) => void
    vi.mocked(sendMessage).mockReturnValueOnce(
      new Promise<TrackImportResult>((resolve) => {
        resolveImport = resolve
      }),
    )
    renderImportForm()

    await uploadValidFile(user)
    const importButton = screen.getByRole('button', { name: 'Import Tracks' })

    await user.click(importButton)
    await user.click(importButton)

    expect(importButton).toBeDisabled()
    expect(screen.getByLabelText('Tracks import file')).toBeDisabled()
    expect(sendMessage).toHaveBeenCalledTimes(1)

    resolveImport({
      createdTrackIds: ['track-one'],
      createdTrackCount: 1,
      createdProblemCount: 1,
      reusedProblemCount: 0,
    })
  })

  it('reports created and reused counts and offers Done after a successful import', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    vi.mocked(sendMessage).mockResolvedValueOnce({
      createdTrackIds: ['track-one'],
      createdTrackCount: 1,
      createdProblemCount: 2,
      reusedProblemCount: 3,
    })
    renderImportForm({ onDone })

    await uploadValidFile(user)
    await user.click(screen.getByRole('button', { name: 'Import Tracks' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Imported 1 track. Created 2 problems. Reused 3 problems.',
    )
    expect(screen.getByRole('button', { name: 'Import Tracks' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Done' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Cancel' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Done' }))

    expect(onDone).toHaveBeenCalledOnce()
  })

  it('keeps the ready file and allows retry after an import failure', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockRejectedValueOnce(
      new Error('Track title already exists.'),
    )
    renderImportForm()

    await uploadValidFile(user)
    await user.click(screen.getByRole('button', { name: 'Import Tracks' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Track title already exists.',
    )
    expect(screen.getByText('tracks.json')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Import Tracks' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()

    vi.mocked(sendMessage).mockResolvedValueOnce({
      createdTrackIds: ['track-one'],
      createdTrackCount: 1,
      createdProblemCount: 1,
      reusedProblemCount: 1,
    })

    await user.click(screen.getByRole('button', { name: 'Import Tracks' }))

    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Imported 1 track. Created 1 problem. Reused 1 problem.',
    )
  })

  it('uses the fallback message when an import failure has no safe runtime message', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockRejectedValueOnce({
      reason: 'unexpected failure',
    })
    renderImportForm()

    await uploadValidFile(user)
    await user.click(screen.getByRole('button', { name: 'Import Tracks' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Track import failed.',
    )
    expect(screen.getByText('tracks.json')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Import Tracks' })).toBeEnabled()
  })
})

function renderImportForm(options: { onDone?: () => void } = {}) {
  const { wrapper } = createQueryTestHarness()

  return render(
    <TrackImportForm onCancel={vi.fn()} onDone={options.onDone ?? vi.fn()} />,
    { wrapper },
  )
}

async function uploadValidFile(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(
    screen.getByLabelText('Tracks import file'),
    createJsonFile(validImportFile),
  )
}

function createJsonFile(value: unknown, name = 'tracks.json') {
  return new File([JSON.stringify(value)], name, {
    type: 'application/json',
  })
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

function deferFileText(file: File, text: Promise<string>) {
  Object.defineProperty(file, 'text', {
    configurable: true,
    value: vi.fn(() => text),
  })
}

function createImportFile(
  title: string,
  problemSlug: string,
  options: { trackCount?: number } = {},
): TrackImportFile {
  const tracks = [
    {
      description: null,
      dueAt: null,
      title,
      groups: [{ title: 'Arrays', problemSlugs: [problemSlug] }],
    },
  ]

  if (options.trackCount === 2) {
    tracks.push({
      description: null,
      dueAt: null,
      title: `${title} Two`,
      groups: [
        { title: 'Graphs', problemSlugs: ['container-with-most-water'] },
      ],
    })
  }

  return {
    app: 'cognipace-track-import',
    problems: [],
    schemaVersion: 1,
    tracks,
  }
}

const validImportFile = {
  app: 'cognipace-track-import',
  problems: [],
  schemaVersion: 1,
  tracks: [
    {
      description: null,
      dueAt: null,
      title: 'Interview Track',
      groups: [{ title: 'Arrays', problemSlugs: ['two-sum'] }],
    },
  ],
} satisfies TrackImportFile
