import { X } from 'lucide-react'

import type { OverlayDraftField, OverlayDraftLog } from '../../../domain'

type OverlayLogFieldsProps = {
  draft: OverlayDraftLog
  disabled?: boolean
  hasUnpersistedChanges: boolean
  onClearField: (field: OverlayDraftField) => void
  onFieldChange: (field: OverlayDraftField, value: string) => void
}

type LogFieldConfig = {
  control: 'input' | 'textarea'
  field: OverlayDraftField
  label: string
}

const logFieldRows = [
  [
    {
      control: 'input',
      field: 'interviewPattern',
      label: 'Interview Pattern',
    },
  ],
  [
    {
      control: 'input',
      field: 'timeComplexity',
      label: 'Time Complexity',
    },
    {
      control: 'input',
      field: 'spaceComplexity',
      label: 'Space Complexity',
    },
  ],
  [
    {
      control: 'input',
      field: 'languages',
      label: 'Languages',
    },
  ],
  [
    {
      control: 'textarea',
      field: 'notes',
      label: 'Notes',
    },
  ],
] as const satisfies readonly (readonly LogFieldConfig[])[]

export function OverlayLogFields({
  draft,
  disabled,
  hasUnpersistedChanges,
  onClearField,
  onFieldChange,
}: OverlayLogFieldsProps) {
  return (
    <section aria-labelledby="overlay-log-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          id="overlay-log-heading"
        >
          Structured Log
        </h2>
        {hasUnpersistedChanges ? (
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
            Draft changes
          </span>
        ) : null}
      </div>

      <div className="grid gap-3">
        {logFieldRows.map((row) => {
          const fields = row.map((field) => (
            <OverlayLogField
              config={field}
              disabled={disabled}
              key={field.field}
              onChange={onFieldChange}
              onClear={onClearField}
              value={draft[field.field]}
            />
          ))

          return row.length === 1 ? (
            fields[0]
          ) : (
            <div className="grid grid-cols-2 gap-3" key={row[0].field}>
              {fields}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function OverlayLogField({
  config,
  disabled,
  onChange,
  onClear,
  value,
}: {
  config: LogFieldConfig
  disabled?: boolean | undefined
  onChange: (field: OverlayDraftField, value: string) => void
  onClear: (field: OverlayDraftField) => void
  value: string
}) {
  const { control, field, label } = config
  const id = `overlay-log-${field}`
  const controlClassName =
    'w-full border border-border bg-background px-3 pr-9 font-mono text-[0.85rem] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring disabled:opacity-50'

  return (
    <div>
      <label
        className="mb-1 block text-[0.75rem] text-muted-foreground"
        htmlFor={id}
      >
        {label}
      </label>
      <div className="relative">
        {control === 'textarea' ? (
          <textarea
            className={`${controlClassName} min-h-28 resize-y py-2 leading-relaxed`}
            disabled={disabled}
            id={id}
            onChange={(event) => onChange(field, event.target.value)}
            value={value}
          />
        ) : (
          <input
            className={`${controlClassName} h-10`}
            disabled={disabled}
            id={id}
            onChange={(event) => onChange(field, event.target.value)}
            value={value}
          />
        )}
        <ClearLogFieldButton
          disabled={disabled || value.length === 0}
          label={`Clear ${label}`}
          onClick={() => onClear(field)}
        />
      </div>
    </div>
  )
}

function ClearLogFieldButton({
  disabled,
  label,
  onClick,
}: {
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  if (disabled) {
    return null
  }

  return (
    <button
      aria-label={label}
      className="absolute right-1 top-1 flex size-8 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      type="button"
    >
      <X aria-hidden="true" className="size-3.5" />
    </button>
  )
}
