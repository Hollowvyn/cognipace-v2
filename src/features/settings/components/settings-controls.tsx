import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import {
  tooltipContentClassName,
  useTooltipPresence,
} from '@/components/ui/tooltip'
import { cn } from '@/utils/cn'

const inputClassName =
  'h-[var(--cp-control-height)] min-w-0 rounded-[var(--cp-control-radius)] border border-border bg-background px-3 text-[length:var(--cp-control-font-size)] text-foreground shadow-sm transition-[background-color,border-color,color,box-shadow,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60'

interface NumberControlProps {
  ariaLabel?: string
  className?: string
  error?: string | null
  errorMessageId?: string
  id: string
  max?: number
  min?: number
  name?: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}

export function NumberControl({
  ariaLabel,
  className,
  error,
  errorMessageId,
  id,
  max,
  min,
  name,
  onChange,
  placeholder,
  value,
}: NumberControlProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom')
  const resolvedErrorId = errorMessageId ?? `${id}-error`
  const isErrorHintOpen = Boolean(error && (isFocused || isHovered))
  const tooltip = useTooltipPresence(isErrorHintOpen)

  function updateErrorPlacement(target: HTMLElement) {
    const rect = target.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setPlacement(spaceBelow < 88 ? 'top' : 'bottom')
  }

  return (
    <span
      className="relative inline-grid w-fit max-w-full"
      onPointerEnter={(event) => {
        updateErrorPlacement(event.currentTarget)
        setIsHovered(true)
      }}
      onPointerLeave={() => {
        setIsHovered(false)
      }}
    >
      <input
        aria-describedby={error ? resolvedErrorId : undefined}
        aria-invalid={Boolean(error)}
        aria-label={ariaLabel}
        autoComplete="off"
        className={cn(
          'w-24',
          inputClassName,
          error &&
            'border-[color:var(--cp-tone-danger-fg)] focus-visible:ring-[color:var(--cp-tone-danger-fg)]',
          className,
        )}
        id={id}
        inputMode="numeric"
        max={max}
        min={min}
        name={name ?? id}
        onBlur={() => {
          setIsFocused(false)
        }}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        onFocus={(event) => {
          updateErrorPlacement(event.currentTarget)
          setIsFocused(true)
        }}
        placeholder={placeholder}
        type="number"
        value={value}
      />
      {error && tooltip.isPresent ? (
        <span
          aria-live="polite"
          className={cn(
            tooltipContentClassName,
            'absolute left-1/2 w-max max-w-[min(14rem,calc(100vw-2rem))] -translate-x-1/2 border-[color:var(--cp-tone-danger-border)] bg-[color:var(--cp-tone-danger-bg)] px-2 py-1 text-left text-[length:var(--cp-copy-font-size)] font-semibold leading-snug text-[color:var(--cp-tone-danger-fg)]',
            placement === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
          )}
          data-cp-tooltip-motion=""
          data-state={tooltip.state}
          id={resolvedErrorId}
          role="tooltip"
        >
          {error}
        </span>
      ) : error ? (
        <span className="sr-only" id={resolvedErrorId}>
          {error}
        </span>
      ) : null}
    </span>
  )
}

interface SwitchControlProps {
  ariaLabelledBy?: string
  checked: boolean
  disabled?: boolean
  disabledReason?: ReactNode
  id: string
  name?: string
  onChange: (value: boolean) => void
}

export function SwitchControl({
  ariaLabelledBy,
  checked,
  disabled,
  disabledReason,
  id,
  name,
  onChange,
}: SwitchControlProps) {
  const [isReasonOpen, setIsReasonOpen] = useState(false)
  const [placement, setPlacement] = useState<'bottom' | 'right' | 'top'>(
    'bottom',
  )
  const rootRef = useRef<HTMLSpanElement>(null)
  const reasonId = useId()
  const canExplainDisabledState = Boolean(disabled && disabledReason)
  const tooltip = useTooltipPresence(isReasonOpen)

  useEffect(() => {
    if (!isReasonOpen) {
      return
    }

    function closeIfOutside(event: PointerEvent | FocusEvent) {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (!rootRef.current?.contains(target)) {
        setIsReasonOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsReasonOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeIfOutside, true)
    document.addEventListener('focusin', closeIfOutside, true)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeIfOutside, true)
      document.removeEventListener('focusin', closeIfOutside, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isReasonOpen])

  function openDisabledReason() {
    if (!canExplainDisabledState) {
      return
    }

    setPlacement('right')
    setIsReasonOpen(true)
  }

  return (
    <span className="relative inline-flex shrink-0" ref={rootRef}>
      <button
        aria-checked={checked}
        aria-describedby={isReasonOpen ? reasonId : undefined}
        aria-disabled={disabled || undefined}
        aria-expanded={canExplainDisabledState ? isReasonOpen : undefined}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-muted transition-[background-color,border-color,box-shadow,opacity]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
          'hover:border-ring',
          checked && 'border-primary bg-primary',
          disabled && 'cursor-help opacity-60',
        )}
        disabled={disabled && !canExplainDisabledState}
        id={id}
        name={name ?? id}
        onBlur={() => {
          setIsReasonOpen(false)
        }}
        onClick={() => {
          if (disabled) {
            return
          }

          onChange(!checked)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsReasonOpen(false)
          }
        }}
        onFocus={openDisabledReason}
        onPointerEnter={openDisabledReason}
        onPointerLeave={() => {
          setIsReasonOpen(false)
        }}
        role="switch"
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-0.5 size-5 rounded-full bg-card shadow-sm transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
      {tooltip.isPresent ? (
        <span
          aria-hidden={!isReasonOpen}
          className={cn(
            tooltipContentClassName,
            'absolute left-0 w-72 max-w-[min(18rem,calc(100vw-2rem))] bg-background px-3 py-2 text-left text-[length:var(--cp-copy-font-size)] leading-snug text-foreground',
            placement === 'bottom' && 'top-full mt-2',
            placement === 'top' && 'bottom-full mb-2',
            placement === 'right' && 'left-full top-1/2 ml-2 -translate-y-1/2',
          )}
          data-cp-tooltip-motion=""
          data-state={tooltip.state}
          id={reasonId}
          role="tooltip"
        >
          {disabledReason}
        </span>
      ) : null}
    </span>
  )
}

interface SegmentedOption<TValue extends string> {
  label: string
  value: TValue
}

interface SegmentedControlProps<TValue extends string> {
  ariaLabelledBy?: string
  label: string
  name: string
  onChange: (value: TValue) => void
  options: readonly SegmentedOption<TValue>[]
  value: TValue
}

export function SegmentedControl<TValue extends string>({
  ariaLabelledBy,
  label,
  name,
  onChange,
  options,
  value,
}: SegmentedControlProps<TValue>) {
  return (
    <fieldset aria-labelledby={ariaLabelledBy} className="min-w-0">
      <legend
        className={cn(
          'text-[length:var(--cp-control-font-size)] font-semibold leading-tight text-foreground',
          ariaLabelledBy && 'sr-only',
        )}
      >
        {label}
      </legend>
      <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-[var(--cp-control-radius)] border border-border bg-background p-1">
        {options.map((option) => (
          <label
            className="relative min-w-0 max-w-full cursor-pointer"
            key={option.value}
          >
            <input
              checked={option.value === value}
              className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
              name={name}
              onChange={() => {
                onChange(option.value)
              }}
              type="radio"
              value={option.value}
            />
            <span className="pointer-events-none flex min-h-[var(--cp-control-height-sm)] min-w-[6.75rem] max-w-full items-center justify-center rounded-[calc(var(--cp-control-radius)-2px)] border border-transparent bg-transparent px-3 py-1 text-center text-[length:var(--cp-control-font-size)] font-semibold leading-tight text-muted-foreground text-pretty transition-[background-color,border-color,color,box-shadow] peer-checked:border-border peer-checked:bg-muted peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

interface RetentionSliderProps {
  id: string
  name?: string
  onChange: (value: number) => void
  value: number
}

export function RetentionSlider({
  id,
  name,
  onChange,
  value,
}: RetentionSliderProps) {
  const percentValue = Math.round(value * 100)

  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <input
          aria-valuetext={`${percentValue}% target retention`}
          autoComplete="off"
          className="h-[var(--cp-control-height)] w-full accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          id={id}
          max={97}
          min={70}
          name={name ?? id}
          onChange={(event) => {
            onChange(Number(event.target.value) / 100)
          }}
          step={1}
          type="range"
          value={percentValue}
        />
        <output
          className="min-w-[3.5rem] rounded-[var(--cp-radius-sm)] border border-border bg-muted px-2 py-1 text-center text-[length:var(--cp-control-font-size)] font-bold tabular-nums text-foreground"
          htmlFor={id}
        >
          {percentValue}%
        </output>
      </div>
      <div
        aria-hidden="true"
        className="flex justify-between pr-[4.25rem] text-[length:var(--cp-copy-font-size)] text-muted-foreground"
      >
        <span>70%</span>
        <span>97%</span>
      </div>
    </div>
  )
}
