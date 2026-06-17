import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type SearchContextValue = {
  open: boolean
  query: string
  setOpen: (open: boolean) => void
  setQuery: (query: string) => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

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

  const value = useMemo(() => ({ open, query, setOpen, setQuery }), [open, query])

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useSearch() {
  const value = useContext(SearchContext)

  if (!value) {
    throw new Error('useSearch must be used inside SearchProvider')
  }

  return value
}
