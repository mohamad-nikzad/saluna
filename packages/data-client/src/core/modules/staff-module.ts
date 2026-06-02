import type { BusinessHours, StaffSchedule, User } from '@repo/salon-core'
import { WORKING_HOURS } from '@repo/salon-core'
import { DEFAULT_WORKING_DAYS } from '@repo/salon-core/working-days'
import { readCacheTimestamp, writeCacheTimestamp } from '../cache-meta'
import type { HttpTransportPort } from '../../ports/http-transport'
import type { LocalDataPort } from '../../ports/local-data-port'
import { DataClientHttpError } from '../../ports/http-transport'
import { createListenerSet } from '../listeners'
import type { MutationQueuePort } from '../mutation-queue'
import { newOfflineEntityId } from '../offline-entity-id'
import { defaultIsOnline, type OnlineStatusReader } from '../online-status'
import { projectListWithPendingPatches } from '../offline-projection'

const COLLECTION = 'staff'
const KEY_LIST = 'list'

function scheduleKey(staffId: string) {
  return `schedule:${staffId}`
}

type StaffResponse = { staff: User[] }
type StaffScheduleResponse = { schedule: StaffSchedule[]; businessHours: BusinessHours }
type StaffOneServicesResponse = { staff: User }

export type StaffScheduleDayDraft = {
  dayOfWeek: number
  active: boolean
  workingStart: string
  workingEnd: string
}

export type StaffScheduleBundle = {
  schedule: StaffSchedule[]
  businessHours: BusinessHours
}

export interface StaffModuleDeps {
  mutationQueue?: MutationQueuePort | null
  isOnline?: OnlineStatusReader
  getSalonId?: () => Promise<string | null>
}

export interface StaffModule {
  list(): Promise<User[]>
  getById(id: string): Promise<User | null>
  refresh(): Promise<User[]>
  hydrateFromServer(staff: User[]): Promise<void>
  listLastSyncedAt(): Promise<string | null>
  subscribe(fn: (staff: User[]) => void): () => void
  getScheduleBundle(staffId: string): Promise<StaffScheduleBundle | null>
  refreshScheduleBundle(staffId: string): Promise<StaffScheduleBundle | null>
  setServiceIds(staffId: string, serviceIds: string[] | null): Promise<User>
  setSchedule(staffId: string, schedule: StaffScheduleDayDraft[]): Promise<StaffSchedule[]>
}

function defaultBusinessHours(): BusinessHours {
  return {
    workingStart: WORKING_HOURS.start,
    workingEnd: WORKING_HOURS.end,
    slotDurationMinutes: WORKING_HOURS.slotDuration,
    workingDays: DEFAULT_WORKING_DAYS,
  }
}

function buildStaffSchedules(
  salonId: string,
  staffId: string,
  drafts: StaffScheduleDayDraft[]
): StaffSchedule[] {
  const now = new Date()
  return drafts.map((d) => ({
    id: newOfflineEntityId(),
    salonId,
    staffId,
    dayOfWeek: d.dayOfWeek,
    active: d.active,
    workingStart: d.workingStart,
    workingEnd: d.workingEnd,
    createdAt: now,
    updatedAt: now,
  }))
}

export function createStaffModule(
  transport: HttpTransportPort,
  storage: LocalDataPort,
  deps: StaffModuleDeps = {}
): StaffModule {
  const mutationQueue = deps.mutationQueue ?? null
  const isOnline = deps.isOnline ?? defaultIsOnline
  const getSalonId = deps.getSalonId ?? (async () => null)

  const listeners = createListenerSet<User[]>()

  async function persistList(staff: User[]) {
    await storage.set(COLLECTION, KEY_LIST, staff)
    await writeCacheTimestamp(storage, COLLECTION, KEY_LIST)
    listeners.notify(staff)
  }

  async function mergeStaffOverlay(base: User[]): Promise<User[]> {
    return projectListWithPendingPatches({
      mutationQueue,
      base,
      entityType: 'staff_services',
      entityId: (user) => user.id,
      apply: (user, row) => {
        const payload = row.payload as { serviceIds: string[] | null }
        return { ...user, serviceIds: payload.serviceIds }
      },
    })
  }

  async function mergeHydrateFromServer(serverStaff: User[]) {
    await persistList(await mergeStaffOverlay(serverStaff))
  }

  async function fetchList(): Promise<User[]> {
    const data = await transport.json<StaffResponse>('GET', '/api/staff')
    const staff = data.staff ?? []
    await mergeHydrateFromServer(staff)
    return mergeStaffOverlay((await storage.get<User[]>(COLLECTION, KEY_LIST)) ?? staff)
  }

  async function list(): Promise<User[]> {
    const hit = await storage.get<User[]>(COLLECTION, KEY_LIST)
    if (hit !== undefined) return mergeStaffOverlay(hit)
    try {
      return await fetchList()
    } catch {
      return []
    }
  }

  async function readBusinessHoursFallback(): Promise<BusinessHours> {
    const raw = await storage.get<BusinessHours | null>('business_settings', 'settings')
    return raw ?? defaultBusinessHours()
  }

  async function overlayScheduleFromPending(staffId: string): Promise<StaffScheduleBundle | null> {
    if (!mutationQueue) return null
    const pending = await mutationQueue.listForLocalOverlay()
    const row = pending.find(
      (p) => p.entityType === 'staff_schedule' && p.entityId === staffId && p.operation === 'update'
    )
    if (!row) return null
    const p = row.payload as {
      staffId: string
      schedule: StaffScheduleDayDraft[]
      businessHours?: BusinessHours
    }
    const salonId = (await getSalonId()) ?? ''
    const schedule = buildStaffSchedules(salonId, staffId, p.schedule)
    return {
      schedule,
      businessHours: p.businessHours ?? (await readBusinessHoursFallback()),
    }
  }

  async function mergeScheduleBundle(
    base: StaffScheduleBundle | null | undefined,
    staffId: string
  ): Promise<StaffScheduleBundle | null> {
    const pendingOverlay = await overlayScheduleFromPending(staffId)
    if (pendingOverlay) return pendingOverlay
    return base ?? null
  }

  return {
    list,

    async getById(id: string) {
      const rows = await list()
      return rows.find((s) => s.id === id) ?? null
    },

    refresh: fetchList,

    async hydrateFromServer(staff) {
      await mergeHydrateFromServer(staff)
    },

    listLastSyncedAt() {
      return readCacheTimestamp(storage, COLLECTION, KEY_LIST)
    },

    subscribe(fn) {
      return listeners.subscribe(fn)
    },

    async getScheduleBundle(staffId: string) {
      const pendingFirst = await overlayScheduleFromPending(staffId)
      if (pendingFirst) return pendingFirst

      const cached = await storage.get<StaffScheduleBundle>(COLLECTION, scheduleKey(staffId))
      if (cached) return mergeScheduleBundle(cached, staffId)

      if (isOnline()) {
        try {
          const data = await transport.json<StaffScheduleResponse>(
            'GET',
            `/api/staff/${staffId}/schedule`
          )
          await storage.set(COLLECTION, scheduleKey(staffId), data)
          await writeCacheTimestamp(storage, COLLECTION, scheduleKey(staffId))
          return mergeScheduleBundle(data, staffId)
        } catch {
          /* fall through */
        }
      }

      return {
        schedule: [],
        businessHours: await readBusinessHoursFallback(),
      }
    },

    async refreshScheduleBundle(staffId: string) {
      const data = await transport.json<StaffScheduleResponse>('GET', `/api/staff/${staffId}/schedule`)
      await storage.set(COLLECTION, scheduleKey(staffId), data)
      await writeCacheTimestamp(storage, COLLECTION, scheduleKey(staffId))
      const merged = await mergeScheduleBundle(data, staffId)
      return merged ?? data
    },

    async setServiceIds(staffId, serviceIds) {
      if (!mutationQueue || isOnline()) {
        const data = await transport.json<StaffOneServicesResponse>('PATCH', `/api/staff/${staffId}/services`, {
          body: { serviceIds },
        })
        const updated = data.staff
        await storage.delete(COLLECTION, KEY_LIST)
        listeners.notify(await list())
        return updated
      }

      const rows = await list()
      const existing = rows.find((u) => u.id === staffId)
      if (!existing) {
        throw new DataClientHttpError('کاربر یافت نشد', 404, null)
      }
      if (existing.role !== 'staff') {
        throw new DataClientHttpError('فقط برای پرسنل مجاز است', 400, null)
      }

      const next: User = { ...existing, serviceIds }

      const pend = await mutationQueue.listForLocalOverlay()
      const prevRow = pend.find((p) => p.entityType === 'staff_services' && p.entityId === staffId)

      await mutationQueue.runAtomically(async (txQueue, txStorage) => {
        await txStorage.set(COLLECTION, KEY_LIST, rows.map((u) => (u.id === staffId ? next : u)))
        await writeCacheTimestamp(txStorage, COLLECTION, KEY_LIST)
        if (prevRow) {
          await txQueue.save({
            ...prevRow,
            payload: { staffId, serviceIds },
          })
        } else {
          await txQueue.enqueue({
            entityType: 'staff_services',
            entityId: staffId,
            operation: 'update',
            payload: { staffId, serviceIds },
          })
        }
      })

      listeners.notify(await list())
      return next
    },

    async setSchedule(staffId, scheduleDrafts) {
      if (!mutationQueue || isOnline()) {
        const data = await transport.json<{ schedule: StaffSchedule[] }>('PUT', `/api/staff/${staffId}/schedule`, {
          body: { schedule: scheduleDrafts },
        })
        await storage.delete(COLLECTION, scheduleKey(staffId))
        return data.schedule ?? []
      }

      const rows = await list()
      const member = rows.find((u) => u.id === staffId)
      if (!member || member.role !== 'staff') {
        throw new DataClientHttpError('پرسنل یافت نشد', 404, null)
      }

      const salonId = (await getSalonId()) ?? member.salonId
      const schedule = buildStaffSchedules(salonId, staffId, scheduleDrafts)
      const bh = await readBusinessHoursFallback()
      const bundle: StaffScheduleBundle = { schedule, businessHours: bh }

      const pend = await mutationQueue.listForLocalOverlay()
      const prevRow = pend.find((p) => p.entityType === 'staff_schedule' && p.entityId === staffId)
      const payload = {
        staffId,
        schedule: scheduleDrafts,
        businessHours: bh,
      }

      await mutationQueue.runAtomically(async (txQueue, txStorage) => {
        await txStorage.set(COLLECTION, scheduleKey(staffId), bundle)
        await writeCacheTimestamp(txStorage, COLLECTION, scheduleKey(staffId))
        if (prevRow) {
          await txQueue.save({
            ...prevRow,
            payload,
          })
        } else {
          await txQueue.enqueue({
            entityType: 'staff_schedule',
            entityId: staffId,
            operation: 'update',
            payload,
          })
        }
      })

      return schedule
    },
  }
}
