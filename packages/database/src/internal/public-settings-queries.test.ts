import { describe, expect, it } from 'vitest'

import { buildManagerPublicSettingsUpsertFields } from './public-settings-queries'

describe('buildManagerPublicSettingsUpsertFields', () => {
  it('preserves enabledMessagingProviders when updating other fields', () => {
    const next = buildManagerPublicSettingsUpsertFields(
      'salon-1',
      { enabled: true },
      {
        salonId: 'salon-1',
        enabled: false,
        bioText: null,
        themeId: 'rose',
        layoutId: 'agenda',
        appointmentRequestsEnabled: true,
        depositPolicy: null,
        enabledMessagingProviders: ['telegram'],
        updatedAt: new Date('2026-01-01'),
      },
    )
    expect(next.enabledMessagingProviders).toEqual(['telegram'])
    expect(next.enabled).toBe(true)
  })

  it('defaults enabledMessagingProviders to empty when no row exists', () => {
    const next = buildManagerPublicSettingsUpsertFields('salon-1', {
      enabled: true,
    })
    expect(next.enabledMessagingProviders).toEqual([])
  })
})
