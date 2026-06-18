import { DirectionProvider as RadixDirectionProvider } from '@radix-ui/react-direction'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Direction = 'rtl' | 'ltr'

type DirectionContextValue = {
  direction: Direction
  setDirection: (direction: Direction) => void
}

const DirectionContext = createContext<DirectionContextValue | null>(null)

export function DirectionProvider({
  children,
  defaultDirection = 'rtl',
}: {
  children: ReactNode
  defaultDirection?: Direction
}) {
  const [direction, setDirection] = useState<Direction>(defaultDirection)

  useEffect(() => {
    document.documentElement.dir = direction
    document.documentElement.lang = direction === 'rtl' ? 'fa' : 'en'
  }, [direction])

  const value = useMemo(() => ({ direction, setDirection }), [direction])

  return (
    <RadixDirectionProvider dir={direction}>
      <DirectionContext.Provider value={value}>{children}</DirectionContext.Provider>
    </RadixDirectionProvider>
  )
}

export function useDirection() {
  const value = useContext(DirectionContext)

  if (!value) {
    throw new Error('useDirection must be used inside DirectionProvider')
  }

  return value
}
