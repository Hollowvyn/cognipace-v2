import {
  OverlayShell,
  useLeetCodeOverlaySession,
} from '@/features/overlay-session'

export function OverlayApp() {
  const session = useLeetCodeOverlaySession()

  return <OverlayShell {...session} />
}
