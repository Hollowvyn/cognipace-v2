import type {
  AssessmentLockReason,
  AssessmentReasonCode,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import type { AssessmentDerivedSignals } from '../derived'

export type HardLockOutcome = {
  lockReason: AssessmentLockReason
  reasonCode: AssessmentReasonCode
}

export function applyHardLocks(
  input: LeetCodeAssessmentInput,
  derived: AssessmentDerivedSignals,
): HardLockOutcome | null {
  if (input.intent === 'fail') {
    return { lockReason: 'failed', reasonCode: 'failed' }
  }
  if (derived.isOverTarget && input.timing.strictTiming) {
    return {
      lockReason: 'hard-mode-overtime',
      reasonCode: 'hard-mode-overtime',
    }
  }
  return null
}
