// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SalonLocation } from '@repo/salon-core/iran-locations'
import { SalonLocationFields } from '@repo/ui/salon-location-fields'

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
})

describe('SalonLocationFields', () => {
  it('accepts a free-text neighborhood when city is selected', () => {
    function Harness() {
      const [value, setValue] = useState<SalonLocation>({
        province: 'تهران',
        city: 'تهران',
        neighborhood: '',
      })
      return <SalonLocationFields value={value} onChange={setValue} />
    }

    render(<Harness />)
    const input = screen.getByLabelText('محله (اختیاری)') as HTMLInputElement
    expect(input.disabled).toBe(false)
    fireEvent.change(input, { target: { value: 'محله سفارشی' } })
    expect(input.value).toBe('محله سفارشی')
  })
})
