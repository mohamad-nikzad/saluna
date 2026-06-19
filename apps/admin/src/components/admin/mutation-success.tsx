import { useEffect, useState } from 'react'

export function useMutationSuccess() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(null), 3000)
    return () => window.clearTimeout(timer)
  }, [message])

  return {
    successMessage: message,
    showSuccess: (nextMessage: string) => setMessage(nextMessage),
    clearSuccess: () => setMessage(null),
  }
}

export function MutationSuccess({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="text-sm text-success" role="status">
      {message}
    </p>
  )
}
