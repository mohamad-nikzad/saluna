import { and, asc, eq, inArray } from 'drizzle-orm'
import {
  clientBulkCreateItemSchema,
  type ClientBulkCreateItemPayload,
} from '@repo/salon-core/forms/client'
import { canonicalSalonPhone, phoneLookupVariants } from '@repo/salon-core/phone'
import type { Client, ClientTag } from '@repo/salon-core/types'
import { getDb } from '../client'
import { clients, clientTags } from '../schema'
import {
  isDuplicatePhoneError,
  type BulkCreateClientSkipped,
  type BulkCreateClientSkipReason,
} from './db-errors'
import { rowToClient, rowToClientTag } from './row-mappers'

export type { ClientBulkCreateItemPayload as BulkCreateClientInput } from '@repo/salon-core/forms/client'
export type { BulkCreateClientSkipped, BulkCreateClientSkipReason }
export type BulkCreateClientsResult = {
  created: Client[]
  skipped: BulkCreateClientSkipped[]
}

async function getExistingCanonicalPhones(
  salonId: string,
  phones: string[],
): Promise<Set<string>> {
  const uniquePhones = [...new Set(phones)]
  if (uniquePhones.length === 0) return new Set()

  const db = getDb()
  const allVariants = [...new Set(uniquePhones.flatMap(phoneLookupVariants))]
  const rows = await db
    .select({ phone: clients.phone })
    .from(clients)
    .where(and(eq(clients.salonId, salonId), inArray(clients.phone, allVariants)))

  const existing = new Set<string>()
  for (const row of rows) {
    if (row.phone) existing.add(canonicalSalonPhone(row.phone))
  }
  return existing
}

function mapTagsByClient(rows: ClientTag[]): Map<string, ClientTag[]> {
  const byClient = new Map<string, ClientTag[]>()
  for (const tag of rows) {
    const list = byClient.get(tag.clientId) ?? []
    list.push(tag)
    byClient.set(tag.clientId, list)
  }
  return byClient
}

export async function getAllClients(
  salonId: string,
  options: { includePlaceholders?: boolean } = {}
): Promise<Client[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.salonId, salonId),
        options.includePlaceholders ? undefined : eq(clients.isPlaceholder, false)
      )
    )
    .orderBy(asc(clients.name))
  if (rows.length === 0) return []

  const tagRows = await db
    .select()
    .from(clientTags)
    .where(and(eq(clientTags.salonId, salonId), inArray(clientTags.clientId, rows.map((r) => r.id))))
    .orderBy(asc(clientTags.label))
  const tagsByClient = mapTagsByClient(tagRows.map(rowToClientTag))

  return rows.map((row) => ({
    ...rowToClient(row),
    tags: tagsByClient.get(row.id) ?? [],
  }))
}

export async function getClientById(id: string, salonId: string): Promise<Client | undefined> {
  const db = getDb()
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.salonId, salonId)))
    .limit(1)
  const row = rows[0]
  return row ? rowToClient(row) : undefined
}

export async function getClientByPhone(
  phone: string,
  salonId: string
): Promise<Client | undefined> {
  const db = getDb()
  const variants = phoneLookupVariants(phone)
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.salonId, salonId), inArray(clients.phone, variants)))
    .limit(1)
  const row = rows[0]
  return row ? rowToClient(row) : undefined
}

/** Accepts caller-provided UUIDs for offline-first entities (must be a valid UUID v4 string). */
export function isClientProvidedEntityId(id: string | undefined): id is string {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(id)
  )
}

export async function createClient(
  input: {
    salonId: string
    id?: string
    name: string
    phone?: string | null
    notes?: string
    isPlaceholder?: boolean
  }
): Promise<Client> {
  const db = getDb()
  const values: typeof clients.$inferInsert = {
    salonId: input.salonId,
    name: input.name,
    phone: input.phone ? canonicalSalonPhone(input.phone) : null,
    isPlaceholder: input.isPlaceholder ?? false,
    notes: input.notes,
  }
  if (isClientProvidedEntityId(input.id)) {
    values.id = input.id
  }
  const [row] = await db.insert(clients).values(values).returning()
  return rowToClient(row)
}

export async function createClientsBulk(
  salonId: string,
  items: ClientBulkCreateItemPayload[],
): Promise<BulkCreateClientsResult> {
  const created: Client[] = []
  const skipped: BulkCreateClientSkipped[] = []
  const pending: Array<{ name: string; phone: string }> = []

  for (const item of items) {
    const parsed = clientBulkCreateItemSchema.safeParse(item)
    if (!parsed.success) {
      skipped.push({
        phone: typeof item.phone === 'string' ? item.phone : '',
        reason: 'invalid',
      })
      continue
    }
    pending.push({ name: parsed.data.name, phone: parsed.data.phone })
  }

  const existingPhones = await getExistingCanonicalPhones(
    salonId,
    pending.map((item) => item.phone),
  )
  const seenInBatch = new Set<string>()

  for (const { name, phone } of pending) {
    if (existingPhones.has(phone) || seenInBatch.has(phone)) {
      skipped.push({ phone, reason: 'duplicate-phone' })
      continue
    }

    try {
      const row = await createClient({ salonId, name, phone })
      created.push(row)
      seenInBatch.add(phone)
    } catch (err) {
      if (isDuplicatePhoneError(err)) {
        skipped.push({ phone, reason: 'duplicate-phone' })
        existingPhones.add(phone)
        continue
      }
      skipped.push({ phone, reason: 'invalid' })
    }
  }

  return { created, skipped }
}

export async function updateClient(
  id: string,
  salonId: string,
  data: Partial<Pick<Client, 'name' | 'phone' | 'notes' | 'isPlaceholder'>>
): Promise<Client | undefined> {
  const db = getDb()
  const patch: Partial<typeof clients.$inferInsert> = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.phone !== undefined) patch.phone = data.phone ? canonicalSalonPhone(data.phone) : null
  if (data.notes !== undefined) patch.notes = data.notes
  if (data.isPlaceholder !== undefined) patch.isPlaceholder = data.isPlaceholder

  const [row] = await db
    .update(clients)
    .set(patch)
    .where(and(eq(clients.id, id), eq(clients.salonId, salonId)))
    .returning()
  return row ? rowToClient(row) : undefined
}

export async function deleteClient(id: string, salonId: string): Promise<boolean> {
  const db = getDb()
  const deleted = await db
    .delete(clients)
    .where(and(eq(clients.id, id), eq(clients.salonId, salonId)))
    .returning({ id: clients.id })
  return deleted.length > 0
}

const tagColors: Record<string, string> = {
  VIP: 'bg-amber-100 text-amber-800 border-amber-200',
  'حساسیت': 'bg-rose-100 text-rose-800 border-rose-200',
  'رنگ خاص': 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  'نیاز به پیگیری': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'بدقول': 'bg-orange-100 text-orange-800 border-orange-200',
}

export async function getClientTags(clientId: string, salonId: string): Promise<ClientTag[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(clientTags)
    .where(and(eq(clientTags.salonId, salonId), eq(clientTags.clientId, clientId)))
    .orderBy(asc(clientTags.label))
  return rows.map(rowToClientTag)
}

export async function getClientTagsForClients(
  clientIds: string[],
  salonId: string
): Promise<Map<string, ClientTag[]>> {
  if (clientIds.length === 0) return new Map()
  const db = getDb()
  const rows = await db
    .select()
    .from(clientTags)
    .where(and(eq(clientTags.salonId, salonId), inArray(clientTags.clientId, clientIds)))
    .orderBy(asc(clientTags.label))
  return mapTagsByClient(rows.map(rowToClientTag))
}

export async function setClientTags(
  clientId: string,
  salonId: string,
  labels: string[]
): Promise<ClientTag[]> {
  const db = getDb()
  const normalized = [...new Set(labels.map((l) => l.trim()).filter(Boolean))].slice(0, 8)

  await db.transaction(async (tx) => {
    await tx
      .delete(clientTags)
      .where(and(eq(clientTags.salonId, salonId), eq(clientTags.clientId, clientId)))

    if (normalized.length > 0) {
      await tx.insert(clientTags).values(
        normalized.map((label) => ({
          salonId,
          clientId,
          label,
          color: tagColors[label] ?? 'bg-muted text-foreground border-border',
        }))
      )
    }
  })

  return getClientTags(clientId, salonId)
}
