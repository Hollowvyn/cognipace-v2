import { Badge } from '@/components/ui/badge'

import type { ProblemLibraryStatus } from '../../api/problems-contracts'
import {
  formatProblemLibraryStatus,
  getProblemLibraryStatusTone,
} from './problem-library-formatting'

export function ProblemStatusBadge({
  status,
}: {
  status: ProblemLibraryStatus
}) {
  return (
    <Badge tone={getProblemLibraryStatusTone(status)}>
      {formatProblemLibraryStatus(status)}
    </Badge>
  )
}
