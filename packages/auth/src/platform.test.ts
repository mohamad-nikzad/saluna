import { describe, expect, it } from 'vitest'
import { hasPlatformPermission } from './platform'

describe('platform permissions', () => {
  it('allows only owners to manage platform admins', () => {
    expect(
      hasPlatformPermission('platform_owner', 'manage_platform_admins'),
    ).toBe(true)
    expect(
      hasPlatformPermission('platform_admin', 'manage_platform_admins'),
    ).toBe(false)
    expect(
      hasPlatformPermission('platform_support', 'manage_platform_admins'),
    ).toBe(false)
    expect(
      hasPlatformPermission('platform_viewer', 'manage_platform_admins'),
    ).toBe(false)
  })

  it('keeps viewer read-only', () => {
    expect(hasPlatformPermission('platform_viewer', 'view_salons')).toBe(true)
    expect(hasPlatformPermission('platform_viewer', 'manage_salons')).toBe(
      false,
    )
    expect(
      hasPlatformPermission('platform_viewer', 'write_internal_notes'),
    ).toBe(false)
  })
})
