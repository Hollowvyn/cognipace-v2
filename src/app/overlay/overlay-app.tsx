import { Timer } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { LeetCodeProblemLocation } from '@/lib/leetcode/problem-url'

type OverlayAppProps = {
  problem: LeetCodeProblemLocation
}

export function OverlayApp({ problem }: OverlayAppProps) {
  return (
    <aside className="cp-overlay-host cp-stack p-3" aria-label="CogniPace">
      <div className="cp-row">
        <div>
          <p className="cp-kicker">CogniPace</p>
          <h1 className="cp-title">Overlay ready</h1>
        </div>
        <Badge>{problem.slug}</Badge>
      </div>
      <p className="cp-copy">
        The LeetCode host is mounted. Timer, logging, and FSRS submission will
        plug into this surface next.
      </p>
      <Button disabled variant="outline">
        <Timer />
        Start timer
      </Button>
    </aside>
  )
}
