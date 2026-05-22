import { usePopupAppShellController } from '@/features/app-shell'

import { PopupShell } from './popup-shell'

export function PopupApp() {
  const controller = usePopupAppShellController()

  return <PopupShell controller={controller} />
}
