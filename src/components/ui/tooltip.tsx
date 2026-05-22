import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { useEffect, useState, type ComponentProps } from 'react'

import { cn } from '@/utils/cn'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger
export const TOOLTIP_EXIT_ANIMATION_MS = 120

export const tooltipContentClassName =
  'z-[var(--cp-z-tooltip)] max-w-64 rounded-[var(--cp-radius-md)] border border-border bg-card px-2 py-1.5 text-xs font-medium text-card-foreground shadow-overlay'

export function useTooltipPresence(isOpen: boolean) {
  const [isPresent, setIsPresent] = useState(isOpen)

  useEffect(() => {
    if (isOpen) {
      const timeoutId = window.setTimeout(() => {
        setIsPresent(true)
      }, 0)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    const timeoutId = window.setTimeout(() => {
      setIsPresent(false)
    }, TOOLTIP_EXIT_ANIMATION_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isOpen])

  return {
    isPresent,
    state: isOpen ? 'open' : 'closed',
  } as const
}

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Content
      className={cn(
        tooltipContentClassName,
        className,
      )}
      data-cp-tooltip-motion=""
      sideOffset={sideOffset}
      {...props}
    />
  )
}
