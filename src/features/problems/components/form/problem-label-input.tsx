import { X } from 'lucide-react'
import { useId, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import {
  normalizeProblemLabel,
  normalizeProblemLabelList,
} from './use-problem-form'

export interface ProblemLabelOption {
  id: string
  label: string
}

export function ProblemLabelInput({
  itemName,
  label,
  labels,
  onChange,
  options,
}: {
  itemName: 'company' | 'topic'
  label: 'Companies' | 'Topics'
  labels: readonly string[]
  onChange: (labels: string[]) => void
  options: readonly ProblemLabelOption[]
}) {
  const inputId = useId()
  const optionsId = `${inputId}-options`
  const [draft, setDraft] = useState('')

  function addDraftLabel() {
    const nextLabel = readCanonicalLabel(draft, options)

    if (!nextLabel) {
      return
    }

    onChange(normalizeProblemLabelList([...labels, nextLabel]))
    setDraft('')
  }

  function removeLabel(labelToRemove: string) {
    onChange(labels.filter((currentLabel) => currentLabel !== labelToRemove))
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-[length:var(--cp-badge-font-size)] font-bold uppercase text-muted-foreground">
        {label}
      </legend>
      <div className="flex min-w-0 gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{label}</span>
          <input
            autoComplete="off"
            className="h-[var(--cp-control-height-lg)] w-full rounded-[var(--cp-control-radius)] border border-border bg-background px-3 text-[length:var(--cp-control-font-size)] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            list={optionsId}
            name={itemName === 'topic' ? 'problem-topics' : 'problem-companies'}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addDraftLabel()
              }
            }}
            value={draft}
          />
        </label>
        <Button onClick={addDraftLabel} type="button" variant="outline">
          Add {label}
        </Button>
      </div>
      <datalist id={optionsId}>
        {options.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>
      {labels.length > 0 ? (
        <ul
          aria-label={`Selected ${label.toLowerCase()}`}
          className="m-0 flex list-none flex-wrap gap-2 p-0"
        >
          {labels.map((currentLabel) => (
            <li key={currentLabel}>
              <Badge className="gap-1 pr-1" tone="neutral" variant="outline">
                <span className="max-w-52 break-words text-left leading-tight">
                  {currentLabel}
                </span>
                <button
                  aria-label={`Remove ${itemName} ${currentLabel}`}
                  className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => removeLabel(currentLabel)}
                  type="button"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  )
}

function readCanonicalLabel(
  draft: string,
  options: readonly ProblemLabelOption[],
) {
  const normalizedLabel = normalizeProblemLabel(draft)
  const existingOption = options.find(
    (option) => option.label.toLowerCase() === normalizedLabel.toLowerCase(),
  )

  return existingOption?.label ?? normalizedLabel
}
