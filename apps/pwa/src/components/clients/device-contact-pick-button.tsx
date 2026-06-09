import { Contact } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { cn } from '@repo/ui/utils'

type DeviceContactPickButtonProps = {
  onClick: () => void
  variant?: 'outline' | 'list-item'
  className?: string
}

export function DeviceContactPickButton({
  onClick,
  variant = 'outline',
  className,
}: DeviceContactPickButtonProps) {
  if (variant === 'list-item') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex min-h-12 w-full items-center gap-2.5 px-3 py-3 text-sm font-medium text-primary transition-colors touch-manipulation hover:bg-primary/5 active:bg-primary/10',
          className,
        )}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Contact className="h-3.5 w-3.5" />
        </div>
        <span>افزودن از مخاطبین</span>
      </button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn('touch-manipulation', className)}
    >
      <Contact className="ml-2 h-4 w-4" />
      افزودن از مخاطبین
    </Button>
  )
}
