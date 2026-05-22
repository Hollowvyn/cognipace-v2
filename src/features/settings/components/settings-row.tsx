import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'

import {
  tooltipContentClassName,
  useTooltipPresence,
} from '@/components/ui/tooltip'
import { cn } from '@/utils/cn'

interface SettingsRowProps {
  children: ReactNode
  controlClassName?: string
  hint?: ReactNode
  id: string
  label: ReactNode
  labelFor?: string
}

export function SettingsRow({
  children,
  controlClassName,
  hint,
  id,
  label,
  labelFor,
}: SettingsRowProps) {
  const labelId = readSettingsRowLabelId(id)
  const LabelElement = labelFor ? 'label' : 'div'

  return (
    <div className="grid min-w-0 gap-1 py-2.5 first:pt-0 last:pb-0">
      <div className="grid min-w-0 gap-2.5 md:grid-cols-[minmax(12rem,16.5rem)_minmax(12rem,34rem)] md:items-center md:gap-x-5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <LabelElement
              className="block min-w-0 text-[0.9375rem] font-semibold leading-snug text-foreground"
              {...(labelFor ? { htmlFor: labelFor } : {})}
              id={labelId}
            >
              {label}
            </LabelElement>
            {hint ? (
              <SettingsHint
                label={
                  typeof label === 'string'
                    ? `${label} details`
                    : 'Setting details'
                }
              >
                {hint}
              </SettingsHint>
            ) : null}
          </div>
        </div>
        <div className={cn('min-w-0 md:justify-self-start', controlClassName)}>
          {children}
        </div>
      </div>
    </div>
  )
}

interface SettingsHintProps {
  children: ReactNode
  label: string
}

const SETTINGS_HINT_AUTO_CLOSE_MS = 6000

export function SettingsHint({ children, label }: SettingsHintProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom')
  const rootRef = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()
  const tooltip = useTooltipPresence(isOpen)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsOpen(false)
    }, SETTINGS_HINT_AUTO_CLOSE_MS)

    function closeIfOutside(event: PointerEvent | FocusEvent) {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (!rootRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeIfOutside, true)
    document.addEventListener('focusin', closeIfOutside, true)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      window.clearTimeout(timeoutId)
      document.removeEventListener('pointerdown', closeIfOutside, true)
      document.removeEventListener('focusin', closeIfOutside, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  return (
    <span className="relative inline-flex shrink-0" ref={rootRef}>
      <button
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label={label}
        className="inline-grid size-5 shrink-0 place-items-center rounded-full bg-transparent text-foreground transition-[background-color,color,box-shadow] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const spaceBelow = window.innerHeight - rect.bottom
          setPlacement(spaceBelow < 112 ? 'top' : 'bottom')
          setIsOpen((current) => !current)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false)
          }
        }}
        type="button"
      >
        <Info aria-hidden="true" className="size-3.5" />
      </button>
      {tooltip.isPresent ? (
        <span
          aria-hidden={!isOpen}
          className={cn(
            tooltipContentClassName,
            'absolute left-0 w-72 max-w-[min(18rem,calc(100vw-2rem))] bg-background px-3 py-2 text-left text-[length:var(--cp-copy-font-size)] leading-snug text-foreground',
            placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
          )}
          data-cp-tooltip-motion=""
          data-state={tooltip.state}
          id={tooltipId}
          role="tooltip"
        >
          {children}
        </span>
      ) : null}
    </span>
  )
}

export function readSettingsRowLabelId(id: string) {
  return `${id}-label`
}

export function readSettingsRowErrorId(id: string) {
  return `${id}-error`
}
