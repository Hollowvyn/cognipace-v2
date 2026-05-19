export interface AppShellMetric {
  label: string
  value: string
}

export interface AppShellData {
  status: {
    label: string
    detail: string
  }
  metrics: AppShellMetric[]
  recommendation: {
    title: string
    detail: string
  }
  activeTrack: {
    title: string
    detail: string
  }
}
