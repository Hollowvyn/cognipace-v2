import type { PopupControllerStatus } from '@/features/app-shell'

export function ScopedStatus({
  status,
}: {
  status: Exclude<PopupControllerStatus, null> | null
}) {
  if (!status?.message) {
    return null
  }

  return (
    <p
      className="mt-2 text-[0.75rem] leading-snug text-muted-foreground"
      role={status.isError ? 'alert' : 'status'}
    >
      {status.message}
    </p>
  )
}
