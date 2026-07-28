import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@repo/ui/button'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  error: Error | null
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AppErrorBoundary caught render error', error, info)
  }

  private handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          مشکلی در اجرای برنامه پیش آمد
        </p>
        <p className="text-xs text-destructive">{this.state.error.message}</p>
        <Button type="button" variant="outline" onClick={this.handleReset}>
          تلاش مجدد
        </Button>
      </div>
    )
  }
}
