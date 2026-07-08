import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  normalizeServiceAddonName,
  normalizeServiceAddonScopes,
  validateComboComponentReplacement,
  validateServiceAddonDeltas,
} from './service-queries'

describe('combo component replacement validation', () => {
  it('allows inactive combo drafts without components', () => {
    expect(() =>
      validateComboComponentReplacement({
        comboServiceId: 'combo-1',
        comboActive: false,
        componentServiceIds: [],
        foundComponents: [],
      }),
    ).not.toThrow()
  })

  it('rejects active combos without components', () => {
    expect(() =>
      validateComboComponentReplacement({
        comboServiceId: 'combo-1',
        comboActive: true,
        componentServiceIds: [],
        foundComponents: [],
      }),
    ).toThrow('active combo service must have at least one component')
  })

  it('rejects self references, duplicates, nested combos, and missing services', () => {
    expect(() =>
      validateComboComponentReplacement({
        comboServiceId: 'combo-1',
        comboActive: true,
        componentServiceIds: ['combo-1'],
        foundComponents: [{ id: 'combo-1', kind: 'standard' }],
      }),
    ).toThrow('combo service cannot contain itself')

    expect(() =>
      validateComboComponentReplacement({
        comboServiceId: 'combo-1',
        comboActive: true,
        componentServiceIds: ['svc-1', 'svc-1'],
        foundComponents: [{ id: 'svc-1', kind: 'standard' }],
      }),
    ).toThrow('combo components cannot contain duplicates')

    expect(() =>
      validateComboComponentReplacement({
        comboServiceId: 'combo-1',
        comboActive: true,
        componentServiceIds: ['svc-1', 'svc-2'],
        foundComponents: [{ id: 'svc-1', kind: 'standard' }],
      }),
    ).toThrow('combo component service not found')

    expect(() =>
      validateComboComponentReplacement({
        comboServiceId: 'combo-1',
        comboActive: true,
        componentServiceIds: ['svc-1'],
        foundComponents: [{ id: 'svc-1', kind: 'combo' }],
      }),
    ).toThrow('combo service cannot contain another combo service')
  })
})

describe('service add-on core validation', () => {
  it('requires non-negative deltas with at least one positive value', () => {
    expect(() =>
      validateServiceAddonDeltas({ priceDelta: 0, durationDelta: 15 }),
    ).not.toThrow()
    expect(() =>
      validateServiceAddonDeltas({ priceDelta: 50000, durationDelta: 0 }),
    ).not.toThrow()
    expect(() =>
      validateServiceAddonDeltas({ priceDelta: 0, durationDelta: 0 }),
    ).toThrow('service add-on price or duration delta must be positive')
    expect(() =>
      validateServiceAddonDeltas({ priceDelta: -1, durationDelta: 0 }),
    ).toThrow('service add-on price and duration deltas must be non-negative')
  })

  it('normalizes active add-on names for uniqueness checks', () => {
    expect(normalizeServiceAddonName('  فرنچ   ناخن  ')).toBe('فرنچ ناخن')
  })

  it('removes redundant child scopes covered by broader scopes', () => {
    const scopes = normalizeServiceAddonScopes(
      [
        { type: 'category', categoryId: 'category-1' },
        { type: 'family', familyId: 'family-1' },
        { type: 'service', serviceId: 'service-1' },
        { type: 'family', familyId: 'family-2' },
        { type: 'service', serviceId: 'service-2' },
        { type: 'service', serviceId: 'service-3' },
      ],
      {
        families: [
          { id: 'family-1', categoryId: 'category-1' },
          { id: 'family-2', categoryId: 'category-2' },
          { id: 'family-3', categoryId: 'category-3' },
        ],
        services: [
          { id: 'service-1', categoryId: 'category-1', familyId: 'family-1' },
          { id: 'service-2', categoryId: 'category-2', familyId: 'family-2' },
          { id: 'service-3', categoryId: 'category-3', familyId: 'family-3' },
          { id: 'service-4', categoryId: 'category-2', familyId: 'family-2' },
        ],
      },
    )

    expect(scopes).toEqual([
      { type: 'category', categoryId: 'category-1' },
      { type: 'service', serviceId: 'service-2' },
      { type: 'service', serviceId: 'service-4' },
      { type: 'service', serviceId: 'service-3' },
    ])
  })

  it('uses explicit all scope as the global availability winner', () => {
    const scopes = normalizeServiceAddonScopes(
      [
        { type: 'category', categoryId: 'category-1' },
        { type: 'service', serviceId: 'service-1' },
        { type: 'all' },
      ],
      {
        families: [],
        services: [
          { id: 'service-1', categoryId: 'category-1', familyId: null },
        ],
      },
    )

    expect(scopes).toEqual([{ type: 'all' }])
  })
})

describe('service catalog package migration SQL', () => {
  const migrationSql = readFileSync(
    fileURLToPath(
      new URL('../migrations/0016_familiar_cerise.sql', import.meta.url),
    ),
    'utf8',
  )
  const staffPackageCapabilityMigrationSql = readFileSync(
    fileURLToPath(
      new URL(
        '../migrations/0017_staff_package_capabilities.sql',
        import.meta.url,
      ),
    ),
    'utf8',
  )

  it('migrates complete legacy combos without deleting historical service references', () => {
    expect(migrationSql).toContain('INSERT INTO "service_packages"')
    expect(migrationSql).toContain('"source_legacy_service_id"')
    expect(migrationSql).toContain('INSERT INTO "service_package_components"')
    expect(staffPackageCapabilityMigrationSql).toContain(
      'CREATE TABLE "staff_package_capabilities"',
    )
    expect(staffPackageCapabilityMigrationSql).toContain(
      'packages."source_legacy_service_id" = staff_services."service_id"',
    )
    expect(staffPackageCapabilityMigrationSql).toContain('unrestricted_staff')
    expect(migrationSql).toContain(
      'UPDATE "services"\nSET "active" = false\nWHERE "kind" = \'combo\'',
    )
    expect(migrationSql).not.toMatch(/DELETE FROM "services"/)
    expect(migrationSql).not.toMatch(/UPDATE "appointments"/)
    expect(migrationSql).not.toMatch(/UPDATE "appointment_requests"/)
  })

  it('records incomplete combos and migrates legacy add-on availability scopes', () => {
    expect(migrationSql).toContain('legacy_combo_missing_components')
    expect(migrationSql).toContain('jsonb_build_object')
    expect(migrationSql).toContain('FROM "service_addon_category_scopes"')
    expect(migrationSql).toContain('FROM "service_addon_service_scopes"')
    expect(migrationSql).toContain(
      'FROM "service_addon_family_scopes" family_scopes',
    )
    expect(migrationSql).toContain(
      'SELECT addons."salon_id", addons."id", \'all\', NULL',
    )
  })
})
