import type {
  AppShellQueueItem,
  DashboardAppShellData,
} from '../api/app-shell-contracts'

export interface DashboardOverviewMetricView {
  label: string
  value: string
  caption: string
}

export type DashboardOverviewPrimaryView =
  | {
      kind: 'problem'
      kicker: 'Review Now'
      title: string
      detail: string
      actionLabel: 'Open Problem'
      categoryLabel: string
      dueAt: string | null
      isOverdue: boolean
      problem: NonNullable<DashboardAppShellData['recommendation']['problem']>
    }
  | {
      kind: 'queue-clear'
      kicker: 'Review Now'
      title: 'Queue Clear'
      detail: string
      actionLabel: 'Open Library'
    }

export interface DashboardOverviewView {
  primary: DashboardOverviewPrimaryView
  metrics: DashboardOverviewMetricView[]
  activeTrack: DashboardAppShellData['activeTrack']
  queuePreview: AppShellQueueItem[]
}

export function createDashboardOverviewView(
  data: DashboardAppShellData,
): DashboardOverviewView {
  return {
    primary: createPrimaryView(data),
    metrics: createMetricViews(data),
    activeTrack: data.activeTrack,
    queuePreview: data.overview.queuePreview.slice(0, 5),
  }
}

function createPrimaryView(
  data: DashboardAppShellData,
): DashboardOverviewPrimaryView {
  const problem = data.recommendation.problem

  if (!problem) {
    return {
      kind: 'queue-clear',
      kicker: 'Review Now',
      title: 'Queue Clear',
      detail:
        'No review pressure is waiting. Browse the Library when you want extra practice.',
      actionLabel: 'Open Library',
    }
  }

  const queueItem = data.queue.items.find(
    (item) => item.problem.problemSlug === problem.problemSlug,
  )

  return {
    kind: 'problem',
    kicker: 'Review Now',
    title: problem.title,
    detail: data.recommendation.detail,
    actionLabel: 'Open Problem',
    categoryLabel: readCategoryLabel(data.recommendation.category),
    dueAt: data.recommendation.dueAt,
    isOverdue: queueItem?.state.isOverdue ?? false,
    problem,
  }
}

function createMetricViews(
  data: DashboardAppShellData,
): DashboardOverviewMetricView[] {
  const progress = data.overview.practiceProgress

  return [
    {
      label: 'Due',
      value: String(data.queue.dueCount),
      caption: 'Problems ready for review.',
    },
    {
      label: 'Completed Today',
      value:
        progress.dailyGoal > 0
          ? `${progress.completedToday}/${progress.dailyGoal}`
          : String(progress.completedToday),
      caption:
        progress.dailyGoal > 0
          ? 'Unique problems practiced.'
          : 'Daily goal is disabled.',
    },
    {
      label: 'Streak',
      value: String(progress.currentStreak),
      caption: 'Goal-qualified days.',
    },
  ]
}

function readCategoryLabel(
  category: DashboardAppShellData['recommendation']['category'],
) {
  switch (category) {
    case 'due':
      return 'Due'
    case 'new':
      return 'New'
    case 'reinforcement':
      return 'Extra Practice'
    case null:
      return 'Review'
  }
}
