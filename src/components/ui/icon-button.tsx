import type { ReactNode } from 'react'

import { Button, type ButtonProps } from './button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

type IconButtonSize = 'sm' | 'md' | 'icon'

export interface IconButtonProps extends Omit<
  ButtonProps,
  'aria-label' | 'children' | 'size'
> {
  children: ReactNode
  label: string
  size?: IconButtonSize
  tooltip?: string
}

export function IconButton({
  children,
  label,
  size = 'icon',
  tooltip,
  ...props
}: IconButtonProps) {
  const button = (
    <Button aria-label={label} size={size} {...props}>
      {children}
    </Button>
  )

  if (!tooltip) {
    return button
  }

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
