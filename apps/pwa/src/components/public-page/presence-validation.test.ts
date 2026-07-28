// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { FieldErrors } from 'react-hook-form'
import type { PresenceInput } from '@repo/salon-core/forms/presence'

import {
  getFirstInvalidPresenceField,
  PRESENCE_FIELD_ORDER,
  presenceFieldInputId,
  revealInvalidPresenceField,
} from './presence-validation'

describe('getFirstInvalidPresenceField', () => {
  it('returns the first invalid field in display order', () => {
    const errors: FieldErrors<PresenceInput> = {
      mapBalad: { type: 'custom', message: 'لینک بلد معتبر نیست' },
      mapGoogle: { type: 'custom', message: 'لینک گوگل مپ معتبر نیست' },
      city: { type: 'custom', message: 'شهر معتبر نیست' },
      website: { type: 'custom', message: 'آدرس وب‌سایت معتبر نیست' },
    }

    expect(getFirstInvalidPresenceField(errors)).toBe('city')
  })

  it('returns null when there are no field errors', () => {
    expect(getFirstInvalidPresenceField({})).toBeNull()
    const rootOnlyErrors = {
      root: { type: 'server', message: 'خطا' },
    } as FieldErrors<PresenceInput>
    expect(getFirstInvalidPresenceField(rootOnlyErrors)).toBeNull()
  })

  it('covers every presence field in order', () => {
    expect(PRESENCE_FIELD_ORDER).toEqual([
      'province',
      'city',
      'neighborhood',
      'address',
      'mapGoogle',
      'mapNeshan',
      'mapBalad',
      'socialInstagram',
      'socialTelegram',
      'socialWhatsapp',
      'website',
    ])
  })
})

describe('revealInvalidPresenceField', () => {
  it('opens the row, focuses the field, and scrolls it into view', () => {
    const row = document.createElement('div')
    row.setAttribute('data-presence-field', 'socialWhatsapp')
    const scrollIntoView = vi.fn()
    row.scrollIntoView = scrollIntoView
    document.body.append(row)

    const setOpen = vi.fn()
    const setFocus = vi.fn()

    revealInvalidPresenceField('socialWhatsapp', { setOpen, setFocus })

    expect(setOpen).toHaveBeenCalledWith('socialWhatsapp')

    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          expect(setFocus).toHaveBeenCalledWith('socialWhatsapp')
          expect(scrollIntoView).toHaveBeenCalledWith({
            block: 'nearest',
            behavior: 'smooth',
          })
          row.remove()
          resolve()
        })
      })
    })
  })
})

describe('presenceFieldInputId', () => {
  it('builds stable ids for focus and aria wiring', () => {
    expect(presenceFieldInputId('website')).toBe('presence-field-website')
  })
})
