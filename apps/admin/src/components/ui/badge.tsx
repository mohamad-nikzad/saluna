import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

import { cn } from '#/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-muted text-muted-foreground',
      success: 'bg-success/12 text-success',
      warning: 'bg-warning/15 text-warning',
      danger: 'bg-destructive/12 text-destructive',
      outline: 'border border-border text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
