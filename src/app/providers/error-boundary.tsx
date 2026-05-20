import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Surface } from '@/components/ui/surface'

type ErrorBoundaryProps = {
  children: ReactNode
  fallback?: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CogniPace surface failed', error, errorInfo)
  }

  override render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <Surface>
            <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
              Surface Error
            </p>
            <h1 className="mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
              CogniPace could not render.
            </h1>
            <p className="mt-1 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
              {this.state.error.message}
            </p>
          </Surface>
        )
      )
    }

    return this.props.children
  }
}
