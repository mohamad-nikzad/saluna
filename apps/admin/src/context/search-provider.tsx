import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'

type SearchContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const value = useMemo(() => ({ open, setOpen }), [open])

  return <SearchContext value={value}>{children}</SearchContext>
}

export function useSearch() {
  const value = use(SearchContext)

  if (!value) {
    throw new Error('useSearch must be used inside SearchProvider')
  }

  return value
}
