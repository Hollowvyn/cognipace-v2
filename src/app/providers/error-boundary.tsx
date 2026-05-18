import { Component, type ErrorInfo, type ReactNode } from 'react'

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
          <div className="cp-card">
            <p className="cp-kicker">Surface Error</p>
            <h1 className="cp-title">CogniPace could not render.</h1>
            <p className="cp-copy">{this.state.error.message}</p>
          </div>
        )
      )
    }

    return this.props.children
  }
}
