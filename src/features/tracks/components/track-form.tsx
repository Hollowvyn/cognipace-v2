import { Loader2, Plus, Search, X, ArrowDown, ArrowUp } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { InlineStatus } from '@/components/ui/inline-status'
import {
  ProblemDifficultyBadge,
  type ProblemLibraryRow,
} from '@/features/problems'
import { cn } from '@/utils/cn'

import {
  useCreateTrack,
  useTrackForEdit,
  useUpdateTrack,
} from '../api/tracks-api'
import type {
  SerializedTrack,
  TrackForEditResponse,
  TracksCreateTrackRequest,
  TracksUpdateTrackRequest,
} from '../api/tracks-contracts'
import {
  useTrackForm,
  type TrackFormFieldErrors,
  type TrackFormGroupState,
} from '../hooks/use-track-form'

type TrackFormProps =
  | {
      mode: 'create'
      onCancel: () => void
      onSaved: () => void
    }
  | {
      mode: 'edit'
      onCancel: () => void
      onLoaded?: ((track: SerializedTrack) => void) | undefined
      onSaved: () => void
      trackId: string
    }

export function TrackForm(props: TrackFormProps) {
  const trackId = props.mode === 'edit' ? props.trackId : undefined
  const onLoaded = props.mode === 'edit' ? props.onLoaded : undefined
  const loadedTrackIdRef = useRef<string | null>(null)
  const editQuery = useTrackForEdit(
    trackId ? { surface: 'dashboard', trackId } : { surface: 'dashboard' },
  )

  useEffect(() => {
    const track = editQuery.data?.track

    if (!track || loadedTrackIdRef.current === track.id) {
      return
    }

    loadedTrackIdRef.current = track.id
    onLoaded?.(track)
  }, [editQuery.data?.track, onLoaded])

  if (editQuery.isPending) {
    return (
      <InlineStatus>
        <Loader2 aria-hidden="true" className="animate-spin" />
        Loading track form…
      </InlineStatus>
    )
  }

  if (editQuery.isError || !editQuery.data) {
    return (
      <InlineStatus role="alert" tone="danger">
        Failed to load track form.
      </InlineStatus>
    )
  }

  if (props.mode === 'edit' && !editQuery.data.track) {
    return (
      <InlineStatus role="alert" tone="danger">
        Track not found.
      </InlineStatus>
    )
  }

  return (
    <TrackFormFields
      key={editQuery.data.track?.id ?? 'create'}
      mode={props.mode}
      onCancel={props.onCancel}
      onSaved={props.onSaved}
      source={editQuery.data}
      trackId={trackId}
    />
  )
}

function TrackFormFields({
  mode,
  onCancel,
  onSaved,
  source,
  trackId,
}: {
  mode: 'create' | 'edit'
  onCancel: () => void
  onSaved: () => void
  source: TrackForEditResponse
  trackId?: string | undefined
}) {
  const createTrack = useCreateTrack()
  const updateTrack = useUpdateTrack()
  const { canSubmit, dispatch, fieldErrors, payload, selectedGroup, state } =
    useTrackForm(source)
  const [searchQuery, setSearchQuery] = useState('')
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const pending = createTrack.isPending || updateTrack.isPending
  const errorId = 'track-form-error'
  const validationError = submitAttempted
    ? getFirstFieldError(fieldErrors)
    : null
  const visibleError = submitError ?? validationError
  const problemRowsBySlug = useMemo(
    () =>
      new Map(
        source.problemRows.map((row) => [row.problem.slug, row] as const),
      ),
    [source.problemRows],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitAttempted(true)
    setSubmitError(null)

    if (!canSubmit || !payload) {
      return
    }

    try {
      if (mode === 'create') {
        const request: TracksCreateTrackRequest = {
          ...payload,
          surface: 'dashboard',
        }

        if (state.setActiveAfterCreate) {
          request.setActive = true
        }

        await createTrack.mutateAsync(request)
      } else if (trackId) {
        const request: TracksUpdateTrackRequest = {
          ...payload,
          surface: 'dashboard',
          trackId,
        }

        await updateTrack.mutateAsync(request)
      }

      onSaved()
    } catch (caughtError) {
      setSubmitError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to save track.',
      )
    }
  }

  return (
    <form
      autoComplete="off"
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
    >
      {visibleError ? (
        <InlineStatus id={errorId} role="alert" tone="danger">
          {visibleError}
        </InlineStatus>
      ) : null}

      <section className="grid gap-4" aria-label="Track metadata">
        <TrackTextField
          describedBy={
            submitAttempted && fieldErrors.title ? errorId : undefined
          }
          invalid={submitAttempted && Boolean(fieldErrors.title)}
          label="Title"
          name="track-title"
          onChange={(title) => dispatch({ type: 'set-title', title })}
          required
          value={state.title}
        />
        <TrackTextareaField
          label="Description"
          name="track-description"
          onChange={(description) =>
            dispatch({ type: 'set-description', description })
          }
          value={state.description}
        />
        <TrackTextField
          label="Target date"
          name="track-due-at"
          onChange={(dueAt) => dispatch({ type: 'set-due-at', dueAt })}
          type="date"
          value={state.dueAt}
        />
        {mode === 'create' ? (
          <label className="inline-flex min-h-[var(--cp-control-height)] w-fit items-center gap-2 text-[length:var(--cp-control-font-size)] font-semibold text-foreground">
            <input
              checked={state.setActiveAfterCreate}
              className="size-4 rounded border-border accent-primary"
              name="track-set-active"
              onChange={(event) =>
                dispatch({
                  checked: event.target.checked,
                  type: 'set-active-after-create',
                })
              }
              type="checkbox"
            />
            <span>Set as active track</span>
          </label>
        ) : null}
      </section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(14rem,0.85fr)_minmax(0,1.15fr)]">
        <TrackGroupList
          dispatch={dispatch}
          fieldErrors={fieldErrors}
          groups={state.groups}
          selectedGroupKey={selectedGroup.key}
          showErrors={submitAttempted}
        />
        <SelectedGroupProblems
          dispatch={dispatch}
          groups={state.groups}
          problemRows={source.problemRows}
          problemRowsBySlug={problemRowsBySlug}
          searchQuery={searchQuery}
          selectedGroup={selectedGroup}
          setSearchQuery={setSearchQuery}
        />
      </div>

      <div className="-mx-[var(--cp-panel-padding)] mt-1 flex justify-end gap-3 border-t border-border px-[var(--cp-panel-padding)] py-4">
        <Button onClick={onCancel} type="button" variant="ghost">
          CANCEL
        </Button>
        <Button disabled={pending} type="submit">
          {pending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : null}
          SAVE
        </Button>
      </div>
    </form>
  )
}

function TrackGroupList({
  dispatch,
  fieldErrors,
  groups,
  selectedGroupKey,
  showErrors,
}: {
  dispatch: ReturnType<typeof useTrackForm>['dispatch']
  fieldErrors: TrackFormFieldErrors
  groups: readonly TrackFormGroupState[]
  selectedGroupKey: string
  showErrors: boolean
}) {
  return (
    <section className="grid min-w-0 content-start gap-3" aria-label="Groups">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h3 className="m-0 text-[length:var(--cp-copy-font-size)] font-bold text-foreground">
          Groups
        </h3>
        <Button
          onClick={() => dispatch({ type: 'add-group' })}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" />
          Add group
        </Button>
      </div>
      <div className="grid gap-2" role="list">
        {groups.map((group, index) => {
          const displayTitle = getGroupDisplayTitle(group, index)
          const isSelected = group.key === selectedGroupKey
          const groupTitleError = fieldErrors.groupTitles[group.key]

          return (
            <div
              className={cn(
                'grid min-w-0 gap-2 rounded-[var(--cp-control-radius)] border border-border p-2',
                isSelected && 'border-primary bg-muted/45',
              )}
              key={group.key}
              role="listitem"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  aria-pressed={isSelected}
                  className="min-w-0 flex-1 justify-start"
                  onClick={() =>
                    dispatch({ groupKey: group.key, type: 'select-group' })
                  }
                  size="sm"
                  type="button"
                  variant={isSelected ? 'secondary' : 'ghost'}
                  aria-label={`Select ${displayTitle}`}
                >
                  <span className="truncate">{displayTitle}</span>
                </Button>
                <IconButton
                  disabled={index === 0}
                  label={`Move ${displayTitle} up`}
                  onClick={() =>
                    dispatch({
                      direction: 'up',
                      groupKey: group.key,
                      type: 'move-group',
                    })
                  }
                  size="sm"
                  tooltip="Move up"
                  type="button"
                  variant="ghost"
                >
                  <ArrowUp aria-hidden="true" />
                </IconButton>
                <IconButton
                  disabled={index === groups.length - 1}
                  label={`Move ${displayTitle} down`}
                  onClick={() =>
                    dispatch({
                      direction: 'down',
                      groupKey: group.key,
                      type: 'move-group',
                    })
                  }
                  size="sm"
                  tooltip="Move down"
                  type="button"
                  variant="ghost"
                >
                  <ArrowDown aria-hidden="true" />
                </IconButton>
                <IconButton
                  disabled={groups.length <= 1 || group.problemSlugs.length > 0}
                  label={`Remove ${displayTitle}`}
                  onClick={() =>
                    dispatch({ groupKey: group.key, type: 'remove-group' })
                  }
                  size="sm"
                  tooltip="Remove empty group"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" />
                </IconButton>
              </div>
              <TrackTextField
                describedBy={
                  showErrors && groupTitleError ? 'track-form-error' : undefined
                }
                invalid={showErrors && Boolean(groupTitleError)}
                label={`Group ${index + 1} title`}
                name={`track-group-${index + 1}-title`}
                onChange={(title) =>
                  dispatch({
                    groupKey: group.key,
                    title,
                    type: 'rename-group',
                  })
                }
                required
                value={group.title}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SelectedGroupProblems({
  dispatch,
  groups,
  problemRows,
  problemRowsBySlug,
  searchQuery,
  selectedGroup,
  setSearchQuery,
}: {
  dispatch: ReturnType<typeof useTrackForm>['dispatch']
  groups: readonly TrackFormGroupState[]
  problemRows: readonly ProblemLibraryRow[]
  problemRowsBySlug: ReadonlyMap<string, ProblemLibraryRow>
  searchQuery: string
  selectedGroup: TrackFormGroupState
  setSearchQuery: (searchQuery: string) => void
}) {
  const selectedProblemSlugSet = new Set(
    groups.flatMap((group) => group.problemSlugs),
  )
  const filteredProblemRows = problemRows.filter(
    (row) =>
      !selectedProblemSlugSet.has(row.problem.slug) &&
      matchesProblemSearch(row, searchQuery),
  )

  return (
    <section
      aria-label="Selected group problems"
      className="grid min-w-0 content-start gap-4"
    >
      <div className="grid gap-1">
        <h3 className="m-0 truncate text-[length:var(--cp-copy-font-size)] font-bold text-foreground">
          {selectedGroup.title.trim() || 'Selected group'} problems
        </h3>
        <p className="m-0 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
          {selectedGroup.problemSlugs.length} selected
        </p>
      </div>

      <OrderedProblemList
        dispatch={dispatch}
        problemRowsBySlug={problemRowsBySlug}
        selectedGroup={selectedGroup}
      />

      <div className="grid gap-3 border-t border-border pt-4">
        <TrackTextField
          icon={<Search aria-hidden="true" />}
          label="Search Library problems"
          name="track-problem-search"
          onChange={setSearchQuery}
          type="search"
          value={searchQuery}
        />
        <div aria-label="Library problem results" className="grid gap-2">
          {filteredProblemRows.length > 0 ? (
            filteredProblemRows.map((row) => (
              <ProblemSearchResult
                key={row.problem.slug}
                onAdd={() =>
                  dispatch({
                    groupKey: selectedGroup.key,
                    problemSlug: row.problem.slug,
                    type: 'add-problem',
                  })
                }
                row={row}
              />
            ))
          ) : (
            <InlineStatus>No matching Library problems.</InlineStatus>
          )}
        </div>
      </div>
    </section>
  )
}

function OrderedProblemList({
  dispatch,
  problemRowsBySlug,
  selectedGroup,
}: {
  dispatch: ReturnType<typeof useTrackForm>['dispatch']
  problemRowsBySlug: ReadonlyMap<string, ProblemLibraryRow>
  selectedGroup: TrackFormGroupState
}) {
  if (selectedGroup.problemSlugs.length === 0) {
    return <InlineStatus>No problems in this group.</InlineStatus>
  }

  return (
    <ol className="m-0 grid list-none gap-2 p-0">
      {selectedGroup.problemSlugs.map((problemSlug, index) => {
        const row = problemRowsBySlug.get(problemSlug)
        const title = row?.problem.title ?? problemSlug

        return (
          <li
            className="grid min-w-0 gap-2 rounded-[var(--cp-control-radius)] border border-border p-2"
            key={problemSlug}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <ProblemSummary row={row} title={title} slug={problemSlug} />
              <span className="shrink-0 text-[length:var(--cp-badge-font-size)] font-bold text-muted-foreground tabular-nums">
                {index + 1}
              </span>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <IconButton
                disabled={index === 0}
                label={`Move ${title} up`}
                onClick={() =>
                  dispatch({
                    direction: 'up',
                    groupKey: selectedGroup.key,
                    problemSlug,
                    type: 'move-problem',
                  })
                }
                size="sm"
                tooltip="Move up"
                type="button"
                variant="ghost"
              >
                <ArrowUp aria-hidden="true" />
              </IconButton>
              <IconButton
                disabled={index === selectedGroup.problemSlugs.length - 1}
                label={`Move ${title} down`}
                onClick={() =>
                  dispatch({
                    direction: 'down',
                    groupKey: selectedGroup.key,
                    problemSlug,
                    type: 'move-problem',
                  })
                }
                size="sm"
                tooltip="Move down"
                type="button"
                variant="ghost"
              >
                <ArrowDown aria-hidden="true" />
              </IconButton>
              <IconButton
                label={`Remove ${title}`}
                onClick={() =>
                  dispatch({
                    groupKey: selectedGroup.key,
                    problemSlug,
                    type: 'remove-problem',
                  })
                }
                size="sm"
                tooltip="Remove"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </IconButton>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ProblemSearchResult({
  onAdd,
  row,
}: {
  onAdd: () => void
  row: ProblemLibraryRow
}) {
  return (
    <div className="grid min-w-0 gap-2 rounded-[var(--cp-control-radius)] border border-border p-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <ProblemSummary
        row={row}
        slug={row.problem.slug}
        title={row.problem.title}
      />
      <Button
        aria-label={`Add ${row.problem.title}`}
        onClick={onAdd}
        size="sm"
        type="button"
        variant="outline"
      >
        <Plus aria-hidden="true" />
        Add
      </Button>
    </div>
  )
}

function ProblemSummary({
  row,
  slug,
  title,
}: {
  row: ProblemLibraryRow | undefined
  slug: string
  title: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 max-w-full truncate text-[length:var(--cp-control-font-size)] font-bold text-foreground">
          {title}
        </span>
        <ProblemDifficultyBadge difficulty={row?.problem.difficulty} />
      </div>
      <p className="m-0 mt-1 truncate text-[length:var(--cp-badge-font-size)] text-muted-foreground">
        {slug}
      </p>
    </div>
  )
}

function TrackTextField({
  describedBy,
  icon,
  invalid = false,
  label,
  name,
  onChange,
  required = false,
  type = 'text',
  value,
}: {
  describedBy?: string | undefined
  icon?: ReactNode | undefined
  invalid?: boolean
  label: string
  name: string
  onChange: (value: string) => void
  required?: boolean
  type?: 'date' | 'search' | 'text'
  value: string
}) {
  return (
    <label className="relative block pt-2">
      <span className={floatingLabelClassName}>{label}</span>
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-[1.15rem] z-10 text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
      ) : null}
      <input
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        className={cn(fieldClassName, icon && 'pl-9')}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  )
}

function TrackTextareaField({
  label,
  name,
  onChange,
  value,
}: {
  label: string
  name: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="relative block pt-2">
      <span className={floatingLabelClassName}>{label}</span>
      <textarea
        autoComplete="off"
        className={cn(fieldClassName, 'min-h-24 resize-y py-3')}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  )
}

function getFirstFieldError(fieldErrors: TrackFormFieldErrors) {
  if (fieldErrors.title) {
    return fieldErrors.title
  }

  if (fieldErrors.groups) {
    return fieldErrors.groups
  }

  if (fieldErrors.problemSlugs) {
    return fieldErrors.problemSlugs
  }

  return Object.values(fieldErrors.groupTitles)[0] ?? null
}

function getGroupDisplayTitle(group: TrackFormGroupState, index: number) {
  return group.title.trim() || `Group ${index + 1}`
}

function matchesProblemSearch(row: ProblemLibraryRow, searchQuery: string) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()

  if (normalizedSearchQuery.length === 0) {
    return true
  }

  return `${row.problem.title} ${row.problem.slug}`
    .toLowerCase()
    .includes(normalizedSearchQuery)
}

const floatingLabelClassName =
  'absolute left-3 top-0 z-10 max-w-[calc(100%-1.5rem)] truncate bg-card px-1 text-[length:var(--cp-badge-font-size)] font-semibold leading-none text-muted-foreground'

const fieldClassName =
  'h-[var(--cp-control-height-lg)] w-full rounded-[var(--cp-control-radius)] border border-border bg-background px-3 pt-1 text-[length:var(--cp-control-font-size)] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70'
