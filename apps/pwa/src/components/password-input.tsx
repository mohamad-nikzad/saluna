import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@repo/ui/input'
import { cn } from '@repo/ui/utils'

type PasswordInputProps = Omit<React.ComponentProps<'input'>, 'type'>

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(({ className, disabled, id, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false)
  const label = visible ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'
  const Icon = visible ? EyeOff : Eye

  return (
    <div className="relative">
      <Input
        id={id}
        ref={ref}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={cn('pl-11', className)}
        {...props}
      />
      <button
        type="button"
        aria-label={label}
        aria-pressed={visible}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setVisible((value) => !value)}
        className={cn(
          'absolute left-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors',
          'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
})

PasswordInput.displayName = 'PasswordInput'
