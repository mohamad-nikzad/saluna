import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'

const SEARCH_DEBOUNCE_MS = 300

export function DataTableToolbar({
  query,
  onQueryChange,
  onReset,
}: {
  query: string
  onQueryChange: (query: string) => void
  onReset: () => void
}) {
  const [inputValue, setInputValue] = useState(query)
  const debounceRef = useRef<number | undefined>(undefined)
  const onQueryChangeRef = useRef(onQueryChange)

  useEffect(() => {
    onQueryChangeRef.current = onQueryChange
  }, [onQueryChange])

  useEffect(() => {
    return () => {
      window.clearTimeout(debounceRef.current)
    }
  }, [])

  function handleChange(value: string) {
    setInputValue(value)
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      onQueryChangeRef.current(value)
    }, SEARCH_DEBOUNCE_MS)
  }

  function handleReset() {
    window.clearTimeout(debounceRef.current)
    setInputValue('')
    onReset()
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <Input
          value={inputValue}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="جستجو در جدول..."
          className="max-w-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          پاک کردن
        </Button>
      </div>
    </div>
  )
}
