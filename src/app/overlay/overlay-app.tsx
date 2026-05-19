import { OverlayPanel } from './overlay-panel'
import { useLeetCodeOverlaySession } from './use-leetcode-overlay-session'

export function OverlayApp() {
  const session = useLeetCodeOverlaySession()

  return <OverlayPanel {...session} />
}
