import { Loader2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import type { SerializedProblem } from '@/features/problems/api/problems-contracts'
import {
  problemDifficulties,
  type ProblemDifficulty,
} from '@/lib/problem-catalog'
import {
  createLeetCodeProblemUrl,
  parseLeetCodeProblemInput,
} from '@/lib/leetcode'
import { cn } from '@/utils/cn'

import {
  ProblemLabelInput,
  type ProblemLabelOption,
} from './problem-label-input'
import {
  createProblemFormValues,
  normalizeProblemLabelList,
  useProblemForm,
  type ProblemFormValues,
} from './use-problem-form'

export type ProblemFormMode = 'create' | 'edit'

export function ProblemFormFields({
  mode,
  onCancel,
  onSaved,
  onSubmit,
  pending,
  problem,
  companyOptions = [],
  selectedCompanyLabels = [],
  selectedTopicLabels = [],
  topicOptions = [],
}: {
  companyOptions?: readonly ProblemLabelOption[]
  mode: ProblemFormMode
  onCancel: () => void
  onSaved: () => void
  onSubmit: (values: ProblemFormValues) => Promise<unknown>
  pending: boolean
  problem?: SerializedProblem | undefined
  selectedCompanyLabels?: readonly string[]
  selectedTopicLabels?: readonly string[]
  topicOptions?: readonly ProblemLabelOption[]
}) {
  const { setField, values } = useProblemForm(
    createProblemFormValues(problem, {
      companyLabels: selectedCompanyLabels,
      topicLabels: selectedTopicLabels,
    }),
  )
  const [error, setError] = useState<ProblemFormError | null>(null)
  const normalizedLocation = parseLeetCodeProblemInput(values.slugOrUrl)
  const isEdit = mode === 'edit'
  const errorId = 'problem-form-error'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedValues = normalizeProblemFormValues(values)
    const validationError = validateProblemForm(normalizedValues, mode)

    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)

    try {
      await onSubmit(normalizedValues)
      onSaved()
    } catch (caughtError) {
      setError({
        field: 'title',
        message:
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to save problem.',
      })
    }
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
    >
      {error ? (
        <InlineStatus id={errorId} role="alert" tone="danger">
          {error.message}
        </InlineStatus>
      ) : null}

      {!isEdit ? (
        <ProblemTextField
          describedBy={error?.field === 'slugOrUrl' ? errorId : undefined}
          invalid={error?.field === 'slugOrUrl'}
          label="LeetCode URL or slug"
          name="problem-slug-or-url"
          onChange={(slugOrUrl) => setField('slugOrUrl', slugOrUrl)}
          required
          value={values.slugOrUrl}
        />
      ) : null}

      <ProblemTextField
        describedBy={error?.field === 'title' ? errorId : undefined}
        invalid={error?.field === 'title'}
        label="Title"
        name="problem-title"
        onChange={(title) => setField('title', title)}
        required
        value={values.title}
      />

      <label className="relative block pt-2">
        <span className="absolute left-3 top-0 z-10 max-w-[calc(100%-1.5rem)] truncate bg-card px-1 text-[length:var(--cp-badge-font-size)] font-semibold leading-none text-muted-foreground">
          Difficulty
        </span>
        <select
          className={fieldClassName}
          name="problem-difficulty"
          onChange={(event) =>
            setField('difficulty', event.target.value as ProblemDifficulty)
          }
          value={values.difficulty}
        >
          {problemDifficulties.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {formatDifficultyOption(difficulty)}
            </option>
          ))}
        </select>
      </label>

      <ProblemTextField
        label="LeetCode URL"
        name="problem-leetcode-url"
        placeholder="Enter a slug to preview the LeetCode URL."
        readOnly
        value={
          normalizedLocation
            ? createLeetCodeProblemUrl(normalizedLocation.slug)
            : problem
              ? createLeetCodeProblemUrl(problem.slug)
              : ''
        }
      />

      <ProblemLabelInput
        itemName="topic"
        label="Topics"
        labels={values.topicLabels}
        onChange={(topicLabels) => setField('topicLabels', topicLabels)}
        options={topicOptions}
      />

      <ProblemLabelInput
        itemName="company"
        label="Companies"
        labels={values.companyLabels}
        onChange={(companyLabels) => setField('companyLabels', companyLabels)}
        options={companyOptions}
      />

      <button
        aria-checked={values.isPremium}
        className="inline-flex min-h-[var(--cp-control-height)] w-fit items-center gap-2 rounded-[var(--cp-control-radius)] text-[length:var(--cp-control-font-size)] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        name="problem-premium"
        onClick={() => setField('isPremium', !values.isPremium)}
        role="switch"
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            'relative inline-flex h-5 w-10 shrink-0 items-center rounded-full border border-border bg-muted transition-colors',
            values.isPremium && 'border-primary bg-primary',
          )}
        >
          <span
            className={cn(
              'absolute left-0.5 size-4 rounded-full bg-foreground/85 shadow-sm transition-transform',
              values.isPremium && 'translate-x-5 bg-primary-foreground',
            )}
          />
        </span>
        <span>LeetCode Premium</span>
      </button>

      <div className="-mx-[var(--cp-panel-padding)] mt-2 flex justify-end gap-3 border-t border-border px-[var(--cp-panel-padding)] py-4">
        <Button
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="ghost"
        >
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

function ProblemTextField({
  describedBy,
  disabled = false,
  invalid = false,
  label,
  name,
  onChange,
  placeholder,
  readOnly = false,
  required = false,
  value,
}: {
  describedBy?: string | undefined
  disabled?: boolean
  invalid?: boolean | undefined
  label: string
  name: string
  onChange?: (value: string) => void
  placeholder?: string | undefined
  readOnly?: boolean
  required?: boolean
  value: string
}) {
  return (
    <label className="relative block pt-2">
      <span className="absolute left-3 top-0 z-10 max-w-[calc(100%-1.5rem)] truncate bg-card px-1 text-[length:var(--cp-badge-font-size)] font-semibold leading-none text-muted-foreground">
        {label}
      </span>
      <input
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={fieldClassName}
        disabled={disabled}
        name={name}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        type="text"
        value={value}
      />
    </label>
  )
}

const fieldClassName =
  'h-[var(--cp-control-height-lg)] w-full rounded-[var(--cp-control-radius)] border border-border bg-background px-3 pt-1 text-[length:var(--cp-control-font-size)] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70 read-only:text-muted-foreground'

interface ProblemFormError {
  field: 'slugOrUrl' | 'title'
  message: string
}

function validateProblemForm(values: ProblemFormValues, mode: ProblemFormMode) {
  if (mode === 'create' && !parseLeetCodeProblemInput(values.slugOrUrl)) {
    return {
      field: 'slugOrUrl',
      message: 'Enter a LeetCode URL or slug.',
    } satisfies ProblemFormError
  }

  if (values.title.trim().length === 0) {
    return {
      field: 'title',
      message: 'Title is required.',
    } satisfies ProblemFormError
  }

  return null
}

function normalizeProblemFormValues(
  values: ProblemFormValues,
): ProblemFormValues {
  return {
    ...values,
    companyLabels: normalizeProblemLabelList(values.companyLabels),
    topicLabels: normalizeProblemLabelList(values.topicLabels),
  }
}

function formatDifficultyOption(difficulty: ProblemDifficulty) {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
}
