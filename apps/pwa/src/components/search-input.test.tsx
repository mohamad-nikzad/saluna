// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { SearchInput } from '@repo/ui/search-input'

afterEach(cleanup)

function ControlledSearchInput({
  initialValue = '',
  clearable,
  clearLabel,
  'aria-label': ariaLabel,
}: {
  initialValue?: string
  clearable?: boolean
  clearLabel?: string
  'aria-label'?: string
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <SearchInput
      value={value}
      onChange={(event) => setValue(event.target.value)}
      clearable={clearable}
      clearLabel={clearLabel}
      aria-label={ariaLabel}
      placeholder="جستجو…"
    />
  )
}

describe('SearchInput', () => {
  it('exposes a labeled search field that updates its value', () => {
    render(<ControlledSearchInput aria-label="جستجوی مشتری" />)

    const input = screen.getByRole('searchbox', { name: 'جستجوی مشتری' })
    expect(input).toHaveProperty('type', 'search')

    fireEvent.change(input, { target: { value: 'آوا' } })
    expect(input).toHaveProperty('value', 'آوا')
  })

  it('shows a clear control when clearable and valued, then clears and refocuses', () => {
    render(
      <ControlledSearchInput
        initialValue="مینا"
        clearable
        aria-label="جستجو"
        clearLabel="پاک کردن جستجو"
      />,
    )

    const input = screen.getByRole('searchbox', { name: 'جستجو' })
    expect(input).toHaveProperty('value', 'مینا')

    fireEvent.click(screen.getByRole('button', { name: 'پاک کردن جستجو' }))
    expect(input).toHaveProperty('value', '')
    expect(document.activeElement).toBe(input)
  })

  it('hides the clear control by default', () => {
    render(<ControlledSearchInput initialValue="مینا" aria-label="جستجو" />)

    expect(screen.queryByRole('button', { name: 'پاک کردن جستجو' })).toBeNull()
  })
})
