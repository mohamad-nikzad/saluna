export function MutationError({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p className="text-sm text-destructive">
      {error instanceof Error ? error.message : 'عملیات ناموفق بود.'}
    </p>
  )
}
