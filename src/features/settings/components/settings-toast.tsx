import {
  FEEDBACK_TOAST_AUTO_HIDE_MS,
  FeedbackToast,
} from '@/components/ui/feedback-toast'

import type { SettingsDraftStatus } from '../hooks/use-settings-draft'

export const SETTINGS_TOAST_AUTO_HIDE_MS = FEEDBACK_TOAST_AUTO_HIDE_MS

interface SettingsToastProps {
  status: SettingsDraftStatus
}

export function SettingsToast({ status }: SettingsToastProps) {
  return (
    <FeedbackToast
      dismissLabel="Dismiss settings feedback"
      label="Settings feedback"
      status={status}
    />
  )
}
