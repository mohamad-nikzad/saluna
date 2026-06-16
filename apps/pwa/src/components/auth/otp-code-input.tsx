import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  REGEXP_ONLY_DIGITS,
} from '@repo/ui/input-otp'
import { cn } from '@repo/ui/utils'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

import { AUTH_OTP_CODE_LENGTH, normalizeOtpCode } from '#/lib/auth-otp'

type OtpCodeInputProps = {
  id?: string
  value: string
  onValueChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  slotClassName?: string
}

export function OtpCodeInput({
  id = 'otp',
  value,
  onValueChange,
  onComplete,
  disabled,
  invalid,
  slotClassName,
}: OtpCodeInputProps) {
  return (
    <div dir="ltr" className="flex justify-center">
      <InputOTP
        id={id}
        maxLength={AUTH_OTP_CODE_LENGTH}
        value={value}
        onChange={(nextValue) => onValueChange(normalizeOtpCode(nextValue))}
        onComplete={(nextValue) => {
          const code = normalizeOtpCode(String(nextValue))
          if (code.length === AUTH_OTP_CODE_LENGTH) onComplete?.(code)
        }}
        pasteTransformer={normalizeOtpCode}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        disabled={disabled}
        containerClassName="justify-center gap-2"
      >
        <InputOTPGroup className="gap-2">
          {Array.from({ length: AUTH_OTP_CODE_LENGTH }, (_, index) => (
            <InputOTPSlot
              key={index}
              index={index}
              formatChar={toPersianDigits}
              aria-invalid={invalid}
              className={cn(
                'h-[52px] w-12 rounded-lg border text-xl font-bold',
                slotClassName,
              )}
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  )
}
