import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { cn } from '@repo/ui/utils'

export const pageHeaderBackButtonClassName =
  'h-10 w-10 shrink-0 rounded-2xl touch-manipulation'

type PageHeaderBackButtonProps = {
  'aria-label'?: string
  className?: string
  disabled?: boolean
} & (
  | { to: string; onClick?: never }
  | { onClick: () => void; to?: never }
)

export function PageHeaderBackButton({
  'aria-label': ariaLabel = 'بازگشت',
  className,
  disabled,
  ...props
}: PageHeaderBackButtonProps) {
  if ('to' in props && props.to) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        asChild
        className={cn(pageHeaderBackButtonClassName, className)}
      >
        <Link to={props.to} aria-label={ariaLabel}>
          <ArrowRight className="h-5 w-5" />
        </Link>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label={ariaLabel}
      onClick={props.onClick}
      disabled={disabled}
      className={cn(pageHeaderBackButtonClassName, className)}
    >
      <ArrowRight className="h-5 w-5" />
    </Button>
  )
}
