import { AlertTriangle } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Admin panel error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h1 className="mt-4 text-xl font-semibold">خطایی رخ داد</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                هنگام نمایش این صفحه خطای غیرمنتظره‌ای رخ داد.
              </p>
              <Button
                className="mt-5"
                type="button"
                onClick={() => window.location.reload()}
              >
                بارگذاری مجدد صفحه
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
