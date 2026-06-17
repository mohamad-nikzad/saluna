import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type LayoutContextValue = {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

const LayoutContext = createContext<LayoutContextValue | null>(null)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const value = useMemo(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar: () => setSidebarOpen((open) => !open),
    }),
    [sidebarOpen],
  )

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export function useLayout() {
  const value = useContext(LayoutContext)

  if (!value) {
    throw new Error('useLayout must be used inside LayoutProvider')
  }

  return value
}
