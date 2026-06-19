import { z } from 'zod'

export const SALON_DETAIL_SECTIONS = [
  'overview',
  'governance',
  'operations',
] as const
export const SALON_OPS_TABS = [
  'clients',
  'appointments',
  'requests',
  'staff',
  'services',
] as const

export type SalonDetailSection = (typeof SALON_DETAIL_SECTIONS)[number]
export type SalonOpsTab = (typeof SALON_OPS_TABS)[number]

const positiveInt = z.coerce.number().int().min(1)

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

const pageSizeSchema = z.coerce
  .number()
  .int()
  .pipe(z.union([z.literal(10), z.literal(20), z.literal(50)]))

export function normalizePageSize(
  value: number,
  fallback: PageSizeOption = DEFAULT_TABLE_SEARCH.pageSize,
): PageSizeOption {
  return PAGE_SIZE_OPTIONS.includes(value as PageSizeOption)
    ? (value as PageSizeOption)
    : fallback
}

export const tableSearchSchema = z.object({
  page: positiveInt.optional().default(1),
  pageSize: pageSizeSchema.optional().default(20),
  q: z.string().optional(),
})

export const auditLogSearchSchema = tableSearchSchema.extend({
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  salonId: z.string().optional(),
})

export const salonDetailSearchSchema = z.object({
  tab: z.enum(SALON_DETAIL_SECTIONS).optional().default('overview'),
  subtab: z.enum(SALON_OPS_TABS).optional().default('clients'),
})

export type TableSearch = z.infer<typeof tableSearchSchema>
export type AuditLogSearch = z.infer<typeof auditLogSearchSchema>
export type SalonDetailSearch = z.infer<typeof salonDetailSearchSchema>

export type TableSearchDefaults = {
  page: number
  pageSize: PageSizeOption
}

export const DEFAULT_TABLE_SEARCH: TableSearchDefaults = {
  page: 1,
  pageSize: 20,
}

export function compactTableSearch(
  input: Partial<TableSearch>,
  defaults: TableSearchDefaults = DEFAULT_TABLE_SEARCH,
): Partial<TableSearch> {
  const out: Partial<TableSearch> = {}
  const page = input.page ?? defaults.page
  const pageSize = normalizePageSize(input.pageSize ?? defaults.pageSize, defaults.pageSize)

  if (page !== defaults.page) out.page = page
  if (pageSize !== defaults.pageSize) out.pageSize = pageSize
  if (input.q) out.q = input.q

  return out
}

export function compactAuditLogSearch(
  input: Partial<AuditLogSearch>,
  defaults: TableSearchDefaults = DEFAULT_TABLE_SEARCH,
): Partial<AuditLogSearch> {
  return {
    ...compactTableSearch(input, defaults),
    ...(input.action ? { action: input.action } : {}),
    ...(input.targetType ? { targetType: input.targetType } : {}),
    ...(input.targetId ? { targetId: input.targetId } : {}),
    ...(input.salonId ? { salonId: input.salonId } : {}),
  }
}

export function compactSalonDetailSearch(
  input: Partial<SalonDetailSearch>,
): Partial<SalonDetailSearch> {
  const out: Partial<SalonDetailSearch> = {}
  const tab = input.tab ?? 'overview'
  const subtab = input.subtab ?? 'clients'

  if (tab !== 'overview') out.tab = tab
  if (tab === 'operations' && subtab !== 'clients') out.subtab = subtab

  return out
}
