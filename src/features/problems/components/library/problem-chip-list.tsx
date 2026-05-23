import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'

interface ProblemChip {
  id: string
  label: string
}

export function ProblemChipList({
  emptyLabel = 'None',
  items,
  limit = 3,
  wrap = false,
}: {
  emptyLabel?: string
  items: readonly ProblemChip[]
  limit?: number
  wrap?: boolean
}) {
  if (items.length === 0) {
    return <span className="text-muted-foreground">{emptyLabel}</span>
  }

  const visibleItems = items.slice(0, limit)
  const hiddenCount = items.length - visibleItems.length

  return (
    <span
      className={cn(
        'flex min-w-0 max-w-full gap-1',
        wrap ? 'flex-wrap' : 'items-center overflow-hidden whitespace-nowrap',
      )}
    >
      {visibleItems.map((item) => (
        <Badge
          className="max-w-[10rem] shrink-0 truncate"
          key={item.id}
          tone="neutral"
          variant="outline"
        >
          {item.label}
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <span
          className={cn(
            'inline-flex items-center rounded-[var(--cp-badge-radius)] border border-border px-2 py-0.5',
            'text-[length:var(--cp-badge-font-size)] font-semibold leading-none text-muted-foreground',
          )}
        >
          +{hiddenCount}
        </span>
      ) : null}
    </span>
  )
}
