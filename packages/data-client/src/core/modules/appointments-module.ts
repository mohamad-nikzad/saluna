import type { Appointment, AppointmentWithDetails, Client, Service, User } from '@repo/salon-core'
import {
  detectScheduleOverlaps,
  isBlockingAppointmentStatus,
  SCHEDULE_CONFLICT_CODES,
  endTimeFromDuration,
  sameAddonIds,
  validateAppointmentWindow,
} from '@repo/salon-core'
import { normalizePhone } from '@repo/salon-core'
import { readCacheTimestamp, writeCacheTimestamp } from '../cache-meta'
import type { HttpTransportPort } from '../../ports/http-transport'
import type { LocalDataPort } from '../../ports/local-data-port'
import { DataClientHttpError } from '../../ports/http-transport'
import { createListenerSet } from '../listeners'
import type { MutationQueuePort } from '../mutation-queue'
import { newOfflineEntityId } from '../offline-entity-id'
import { defaultIsOnline, type OnlineStatusReader } from '../online-status'
import { LOCAL_COLLECTIONS } from '../local-collections'

const COLLECTION = 'appointments'

type AppointmentsListResponse = { appointments: AppointmentWithDetails[] }
type AppointmentOneResponse = { appointment: AppointmentWithDetails }
type AppointmentMutationResponse = {
  appointment?: AppointmentWithDetails
  removedAppointmentId?: string
  cleanup?: boolean
}
type AppointmentCompletePlaceholderResponse = {
  appointment: AppointmentWithDetails
  outcome: 'completed' | 'reassigned'
}

export type PlaceholderClientDraft = {
  name: string
  notes?: string
}

export type AppointmentCreateInput = {
  clientId?: string
  placeholderClient?: PlaceholderClientDraft
  staffId: string
  serviceId: string
  addonIds?: string[]
  date: string
  startTime: string
  endTime?: string
  durationMinutes?: number
  notes?: string
}

export type AppointmentUpdateInput = {
  clientId?: string
  placeholderClient?: PlaceholderClientDraft
  staffId?: string
  serviceId?: string
  addonIds?: string[]
  date?: string
  startTime?: string
  endTime?: string
  durationMinutes?: number
  status?: Appointment['status']
  notes?: string
}

export type AppointmentCompletePlaceholderClientInput = {
  name: string
  phone: string
  notes?: string
  reassignToExistingClientId?: string
}

export type AppointmentMutationResult =
  | { type: 'updated'; appointment: AppointmentWithDetails }
  | { type: 'deleted'; id: string }

function rangeKey(startDate: string, endDate: string) {
  return `range:${startDate}:${endDate}`
}

export type AppointmentsModuleDeps = {
  mutationQueue?: MutationQueuePort | null
  isOnline?: OnlineStatusReader
}

export interface AppointmentsModule {
  list(startDate: string, endDate: string): Promise<AppointmentWithDetails[]>
  getById(id: string): Promise<AppointmentWithDetails | null>
  refresh(startDate: string, endDate: string): Promise<AppointmentWithDetails[]>
  hydrateRangeFromServer(
    startDate: string,
    endDate: string,
    appointments: AppointmentWithDetails[]
  ): Promise<void>
  rangeLastSyncedAt(startDate: string, endDate: string): Promise<string | null>
  create(input: AppointmentCreateInput): Promise<AppointmentWithDetails>
  update(id: string, input: AppointmentUpdateInput): Promise<AppointmentMutationResult>
  completePlaceholderClient(
    id: string,
    input: AppointmentCompletePlaceholderClientInput
  ): Promise<AppointmentWithDetails>
  updateStatus(id: string, status: Appointment['status']): Promise<AppointmentMutationResult>
  remove(id: string): Promise<void>
  subscribe(
    fn: (range: { startDate: string; endDate: string; appointments: AppointmentWithDetails[] }) => void
  ): () => void
}

export function createAppointmentsModule(
  transport: HttpTransportPort,
  storage: LocalDataPort,
  deps: AppointmentsModuleDeps = {}
): AppointmentsModule {
  const mutationQueue = deps.mutationQueue ?? null
  const isOnline = deps.isOnline ?? defaultIsOnline

  const listeners = createListenerSet<{
    startDate: string
    endDate: string
    appointments: AppointmentWithDetails[]
  }>()

  async function persistRange(
    startDate: string,
    endDate: string,
    appointments: AppointmentWithDetails[]
  ) {
    const key = rangeKey(startDate, endDate)
    try {
      await storage.transaction(async (tx) => {
        await tx.set(COLLECTION, key, appointments)
        await writeCacheTimestamp(tx, COLLECTION, key)
        for (const appointment of appointments) {
          await tx.set(COLLECTION, `one:${appointment.id}`, appointment)
        }
      })
    } catch {
      /* Cache writes are best-effort for online hydration. */
    }
    listeners.notify({ startDate, endDate, appointments })
  }

  async function fetchRange(startDate: string, endDate: string): Promise<AppointmentWithDetails[]> {
    const data = await transport.json<AppointmentsListResponse>('GET', '/api/appointments', {
      query: { startDate, endDate },
    })
    const appointments = data.appointments ?? []
    await persistRange(startDate, endDate, appointments)
    return appointments
  }

  async function loadRawRange(startDate: string, endDate: string): Promise<AppointmentWithDetails[]> {
    if (isOnline()) {
      try {
        return await fetchRange(startDate, endDate)
      } catch (error) {
        if (error instanceof DataClientHttpError) return []
        /* fall back to the offline snapshot */
      }
    }
    const key = rangeKey(startDate, endDate)
    const hit = await storage.get<AppointmentWithDetails[]>(COLLECTION, key)
    if (hit !== undefined) return [...hit]
    return []
  }

  async function mergeOverlay(
    startDate: string,
    endDate: string,
    base: AppointmentWithDetails[]
  ): Promise<AppointmentWithDetails[]> {
    if (!mutationQueue) {
      return [...base].sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
    }
    const pending = await mutationQueue.listForLocalOverlay()
    const deleted = new Set<string>()
    const overlay = new Map<string, AppointmentWithDetails>()
    for (const m of pending) {
      if (m.entityType !== 'appointment') continue
      const pay = m.payload as { appointment?: AppointmentWithDetails; removeAppointment?: boolean }
      if (m.operation === 'delete' || pay.removeAppointment) deleted.add(m.entityId)
      if ((m.operation === 'create' || m.operation === 'update') && !pay.removeAppointment) {
        const apt = pay.appointment
        if (apt && apt.date >= startDate && apt.date <= endDate) overlay.set(apt.id, apt)
      }
    }
    const merged = base.filter((a) => !deleted.has(a.id))
    const byId = new Map(merged.map((a) => [a.id, a]))
    for (const [id, apt] of overlay) byId.set(id, apt)
    return [...byId.values()].sort((a, b) =>
      `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`)
    )
  }

  async function invalidateAllRanges() {
    await storage.clearCollection(COLLECTION)
  }

  async function resolveServiceLocal(serviceId: string): Promise<Service | null> {
    for (const key of ['list', 'list:all'] as const) {
      const list = (await storage.get<Service[]>('services', key)) ?? []
      const hit = list.find((s) => s.id === serviceId)
      if (hit) return hit
    }
    const one = await storage.get<Service>('services', `id:${serviceId}`)
    if (one !== undefined) return one
    if (!mutationQueue) return null
    const pending = await mutationQueue.listForLocalOverlay()
    for (const m of pending) {
      if (m.entityType !== 'service' || m.entityId !== serviceId) continue
      if (m.operation === 'create' || m.operation === 'update') {
        const pay = m.payload as { service?: Service }
        if (pay.service) return pay.service
      }
    }
    return null
  }

  async function resolveStaffLocal(staffId: string): Promise<User | null> {
    const staffList = (await storage.get<User[]>('staff', 'list')) ?? []
    return staffList.find((staff) => staff.id === staffId) ?? null
  }

  async function resolveClientLocal(clientId: string): Promise<Client | null> {
    const clients = (await storage.get<Client[]>(LOCAL_COLLECTIONS.clients, 'list')) ?? []
    return (
      clients.find((client) => client.id === clientId) ??
      (await storage.get<Client>(LOCAL_COLLECTIONS.clients, `id:${clientId}`)) ??
      null
    )
  }

  async function updateClientListRecord(
    txStorage: LocalDataPort,
    client: Client,
    includeInList: boolean
  ) {
    await txStorage.set(LOCAL_COLLECTIONS.clients, `id:${client.id}`, client)
    const currentList = (await txStorage.get<Client[]>(LOCAL_COLLECTIONS.clients, 'list')) ?? []
    const without = currentList.filter((item) => item.id !== client.id)
    if (includeInList) {
      await txStorage.set(LOCAL_COLLECTIONS.clients, 'list', [client, ...without])
      await writeCacheTimestamp(txStorage, LOCAL_COLLECTIONS.clients, 'list')
    } else if (without.length !== currentList.length) {
      await txStorage.set(LOCAL_COLLECTIONS.clients, 'list', without)
      await writeCacheTimestamp(txStorage, LOCAL_COLLECTIONS.clients, 'list')
    }
  }

  async function removeClientListRecord(txStorage: LocalDataPort, clientId: string) {
    await txStorage.delete(LOCAL_COLLECTIONS.clients, `id:${clientId}`)
    const currentList = (await txStorage.get<Client[]>(LOCAL_COLLECTIONS.clients, 'list')) ?? []
    const nextList = currentList.filter((item) => item.id !== clientId)
    if (nextList.length !== currentList.length) {
      await txStorage.set(LOCAL_COLLECTIONS.clients, 'list', nextList)
      await writeCacheTimestamp(txStorage, LOCAL_COLLECTIONS.clients, 'list')
    }
    await txStorage.delete(LOCAL_COLLECTIONS.clients, `summary:${clientId}`)
  }

  async function findLocalClientByPhone(phone: string, excludeClientId?: string): Promise<Client | null> {
    const normalizedPhone = normalizePhone(phone)
    const list = (await storage.get<Client[]>(LOCAL_COLLECTIONS.clients, 'list')) ?? []
    const fromList = list.find(
      (client) => client.id !== excludeClientId && client.phone === normalizedPhone
    )
    if (fromList) return fromList

    const keys = await storage.listKeys(LOCAL_COLLECTIONS.clients)
    for (const key of keys) {
      if (!key.startsWith('id:')) continue
      const client = await storage.get<Client>(LOCAL_COLLECTIONS.clients, key)
      if (client && client.id !== excludeClientId && client.phone === normalizedPhone) {
        return client
      }
    }
    return null
  }

  function assertNoOverlap(
    candidate: Pick<
      AppointmentWithDetails,
      'id' | 'staffId' | 'clientId' | 'date' | 'startTime' | 'endTime' | 'status'
    >,
    others: AppointmentWithDetails[],
    excludeId?: string
  ) {
    const rows = others
      .filter((a) => a.id !== excludeId)
      .map((a) => ({
        id: a.id,
        staffId: a.staffId,
        clientId: a.clientId,
        date: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
      }))
    const { staffConflict, clientConflict } = detectScheduleOverlaps(rows, {
      staffId: candidate.staffId,
      clientId: candidate.clientId,
      date: candidate.date,
      startTime: candidate.startTime,
      endTime: candidate.endTime,
      excludeId: candidate.id,
    })
    if (staffConflict) {
      throw new DataClientHttpError('پرسنل در این بازه نوبت دیگری دارد', 409, {
        code: SCHEDULE_CONFLICT_CODES.STAFF_OVERLAP,
      })
    }
    if (clientConflict) {
      throw new DataClientHttpError('مشتری در این بازه نوبت دیگری دارد', 409, {
        code: SCHEDULE_CONFLICT_CODES.CLIENT_OVERLAP,
      })
    }
  }

  function assertPlaceholderSingleUse(
    candidate: Pick<AppointmentWithDetails, 'id' | 'clientId' | 'client'>,
    others: AppointmentWithDetails[]
  ) {
    if (!candidate.client.isPlaceholder) return
    const conflict = others.find((appointment) => appointment.clientId === candidate.clientId)
    if (!conflict) return

    throw new DataClientHttpError('این مشتری موقت قبلاً به نوبت دیگری وصل شده است', 409, {
      code: 'placeholder-reuse',
    })
  }

  async function patchAppointment(
    id: string,
    input: AppointmentUpdateInput
  ): Promise<AppointmentMutationResult> {
    const before = await resolveCurrentAppointment(id)
    const data = await transport.json<AppointmentMutationResponse>('PATCH', `/api/appointments/${id}`, {
      body: input,
    })
    await invalidateAllRanges()
    if (data.removedAppointmentId) {
      await storage.delete(COLLECTION, `one:${data.removedAppointmentId}`)
      if (before?.client.isPlaceholder) {
        await removeClientListRecord(storage, before.clientId)
      }
      return { type: 'deleted', id: data.removedAppointmentId }
    }

    const apt = data.appointment
    if (!apt) {
      throw new DataClientHttpError('پاسخ به‌روزرسانی کامل نبود', 500, data)
    }

    await storage.set(COLLECTION, `one:${apt.id}`, apt)
    listeners.notify({ startDate: apt.date, endDate: apt.date, appointments: [apt] })
    return { type: 'updated', appointment: apt }
  }

  async function resolveCurrentAppointment(id: string): Promise<AppointmentWithDetails | null> {
    const fromStorage = await storage.get<AppointmentWithDetails>(COLLECTION, `one:${id}`)
    if (fromStorage !== undefined) return fromStorage
    if (!mutationQueue) return null
    const pending = await mutationQueue.listForLocalOverlay()
    for (const m of pending) {
      if (m.entityType === 'appointment' && m.entityId === id && m.operation !== 'delete') {
        const pay = m.payload as { appointment?: AppointmentWithDetails; removeAppointment?: boolean }
        if (pay.removeAppointment) return null
        if (pay.appointment) return pay.appointment
      }
    }
    return null
  }

  async function performOfflineUpdate(
    id: string,
    input: AppointmentUpdateInput
  ): Promise<AppointmentMutationResult> {
    const current = await resolveCurrentAppointment(id)
    if (!current) {
      throw new DataClientHttpError('نوبت یافت نشد', 404, null)
    }

    if (input.status === 'cancelled' && current.client.isPlaceholder) {
      const pending = await mutationQueue!.listForLocalOverlay()
      const createRow = pending.find(
        (row) => row.entityType === 'appointment' && row.entityId === id && row.operation === 'create'
      )

      await mutationQueue!.runAtomically(async (txQueue, txStorage) => {
        if (createRow) {
          await txQueue.delete(createRow.id)
        } else {
          await txQueue.enqueue({
            entityType: 'appointment',
            entityId: id,
            operation: 'update',
          payload: {
            id,
            action: 'cancel_incomplete_placeholder',
            patch: { status: 'cancelled' },
            removeAppointment: true,
            localPlaceholderClientId: current.clientId,
            reviewMetadata: {
              action: 'cancel_incomplete_placeholder',
                appointmentId: current.id,
                appointmentDate: current.date,
                placeholderClientId: current.clientId,
              },
            },
          })
        }

        await txStorage.delete(COLLECTION, `one:${id}`)
        await removeClientListRecord(txStorage, current.clientId)
      })

      listeners.notify({ startDate: current.date, endDate: current.date, appointments: [] })
      return { type: 'deleted', id }
    }

    let nextClient = current.client
    let localPlaceholderClientIdToDelete: string | null = null

    if (input.placeholderClient) {
      const nextName = input.placeholderClient.name.trim()
      if (!nextName) {
        throw new DataClientHttpError('نام مشتری موقت الزامی است', 400, {
          code: 'validation-error',
        })
      }
      nextClient = current.client.isPlaceholder
        ? {
            ...current.client,
            name: nextName,
            phone: null,
            isPlaceholder: true,
            notes: input.placeholderClient.notes,
          }
        : {
            id: newOfflineEntityId(),
            name: nextName,
            phone: null,
            isPlaceholder: true,
            notes: input.placeholderClient.notes,
            createdAt: new Date(),
          }
    } else if (input.clientId && input.clientId !== current.clientId) {
      const resolvedClient = await resolveClientLocal(input.clientId)
      if (!resolvedClient) {
        throw new DataClientHttpError('اطلاعات مشتری در حافظه محلی نیست', 400, {
          code: 'missing-reference',
        })
      }
      nextClient = resolvedClient
      if (current.client.isPlaceholder) {
        localPlaceholderClientIdToDelete = current.clientId
      }
    }

    const resolvedStaff = input.staffId ? await resolveStaffLocal(input.staffId) : current.staff
    const resolvedService = input.serviceId
      ? await resolveServiceLocal(input.serviceId)
      : current.service
    if (!resolvedStaff || !resolvedService) {
      throw new DataClientHttpError('اطلاعات پایه نوبت در حافظه محلی نیست', 400, {
        code: 'missing-reference',
      })
    }
    if ((input.addonIds?.length ?? 0) > 0) {
      throw new DataClientHttpError('رزرو افزودنی در حالت آفلاین هنوز در دسترس نیست', 400, {
        code: 'missing-reference',
      })
    }
    const existingAddonIds = current.bookedAddons?.map((line) => line.serviceAddonId) ?? []
    const catalogSelectionChanged =
      (input.serviceId !== undefined && input.serviceId !== current.serviceId) ||
      (input.addonIds !== undefined && !sameAddonIds(input.addonIds, existingAddonIds))

    const next: AppointmentWithDetails = {
      ...current,
      ...input,
      clientId: nextClient.id,
      staffId: resolvedStaff.id,
      serviceId: resolvedService.id,
      bookedServiceName: catalogSelectionChanged ? resolvedService.name : current.bookedServiceName,
      bookedServiceDuration: catalogSelectionChanged
        ? resolvedService.duration
        : current.bookedServiceDuration,
      bookedServicePrice: catalogSelectionChanged ? resolvedService.price : current.bookedServicePrice,
      bookedTotalDuration: catalogSelectionChanged
        ? resolvedService.duration
        : current.bookedTotalDuration,
      bookedTotalPrice: catalogSelectionChanged ? resolvedService.price : current.bookedTotalPrice,
      bookedAddonCount: catalogSelectionChanged ? 0 : current.bookedAddonCount,
      bookedAddons: catalogSelectionChanged ? [] : current.bookedAddons,
      date: input.date ?? current.date,
      startTime: input.startTime ?? current.startTime,
      endTime: input.endTime ?? current.endTime,
      status: input.status ?? current.status,
      notes: input.notes !== undefined ? input.notes : current.notes,
      updatedAt: new Date(),
      client: nextClient,
      staff: resolvedStaff,
      service: resolvedService,
    }

    const win = validateAppointmentWindow(next.startTime, next.endTime)
    if (!win.ok) throw new DataClientHttpError(win.error, 400, { code: 'validation-error' })

    const raw = await loadRawRange(next.date, next.date)
    const merged = await mergeOverlay(next.date, next.date, raw)
    const others = merged.filter((a) => a.id !== id)
    assertPlaceholderSingleUse(next, others)
    if (isBlockingAppointmentStatus(next.status)) {
      assertNoOverlap(next, others, id)
    }

    const pend = await mutationQueue!.listForLocalOverlay()
    const createRow = pend.find((p) => p.entityId === id && p.operation === 'create')
    if (createRow) {
      await mutationQueue!.runAtomically(async (txQueue, txStorage) => {
        const createPayload = createRow.payload as {
          id: string
          localPlaceholderClientId?: string
          createInput: Record<string, unknown>
          appointment: AppointmentWithDetails
        }
        await txQueue.save({
          ...createRow,
          payload: {
            id,
            createInput: {
              ...(next.client.isPlaceholder
                ? {
                    placeholderClient: {
                      name: next.client.name,
                      notes: next.client.notes,
                    },
                  }
                : {
                    clientId: next.clientId,
              }),
              staffId: next.staffId,
              serviceId: next.serviceId,
              addonIds: next.bookedAddons?.map((addon) => addon.serviceAddonId) ?? [],
              date: next.date,
              startTime: next.startTime,
              endTime: next.endTime,
              notes: next.notes,
              durationMinutes: input.durationMinutes,
            },
            ...(input.placeholderClient || next.client.isPlaceholder
              ? { localPlaceholderClientId: next.clientId }
              : createPayload.localPlaceholderClientId
                ? { localPlaceholderClientId: createPayload.localPlaceholderClientId }
                : {}),
            appointment: next,
            reviewMetadata: {
              action: 'create',
              appointmentId: next.id,
              appointmentDate: next.date,
              ...(next.client.isPlaceholder ? { placeholderClientId: next.client.id } : {}),
            },
          },
        })
        await txStorage.set(COLLECTION, `one:${id}`, next)
        if (next.client.isPlaceholder) {
          await updateClientListRecord(txStorage, next.client, false)
        } else {
          await updateClientListRecord(txStorage, next.client, true)
          if (
            createPayload.localPlaceholderClientId &&
            createPayload.localPlaceholderClientId !== next.client.id
          ) {
            await removeClientListRecord(txStorage, createPayload.localPlaceholderClientId)
          }
        }
      })
    } else {
      await mutationQueue!.runAtomically(async (txQueue, txStorage) => {
        await txQueue.enqueue({
          entityType: 'appointment',
          entityId: id,
          operation: 'update',
          payload: {
            id,
            patch: {
              ...input,
              ...(input.placeholderClient
                ? {
                    placeholderClient: {
                      name: next.client.name,
                      notes: next.client.notes,
                    },
                  }
                : {}),
            },
            ...(input.placeholderClient && !current.client.isPlaceholder
              ? { localPlaceholderClientId: next.client.id }
              : {}),
            appointment: next,
            reviewMetadata: {
              action: 'update',
              appointmentId: next.id,
              appointmentDate: next.date,
              ...(next.client.isPlaceholder ? { placeholderClientId: next.client.id } : {}),
            },
          },
        })
        await txStorage.set(COLLECTION, `one:${id}`, next)
        if (input.placeholderClient) {
          await updateClientListRecord(txStorage, next.client, false)
        } else if (localPlaceholderClientIdToDelete) {
          await removeClientListRecord(txStorage, localPlaceholderClientIdToDelete)
        } else if (next.client.isPlaceholder) {
          await updateClientListRecord(txStorage, next.client, false)
        } else if (current.client.isPlaceholder && next.client.id !== current.client.id) {
          await removeClientListRecord(txStorage, current.client.id)
        }
      })
    }

    listeners.notify({ startDate: next.date, endDate: next.date, appointments: [next] })
    return { type: 'updated', appointment: next }
  }

  return {
    async list(startDate, endDate) {
      const base = await loadRawRange(startDate, endDate)
      return mergeOverlay(startDate, endDate, base)
    },

    async getById(id: string) {
      if (mutationQueue) {
        const pending = await mutationQueue.listForLocalOverlay()
        for (const m of pending) {
          if (m.entityType !== 'appointment' || m.entityId !== id) continue
          if (m.operation === 'delete') return null
          const pay = m.payload as { appointment?: AppointmentWithDetails; removeAppointment?: boolean }
          if (pay.removeAppointment) return null
          if (pay.appointment) return pay.appointment
        }
      }

      const key = `one:${id}`
      if (isOnline()) {
        try {
          const data = await transport.json<AppointmentOneResponse>('GET', `/api/appointments/${id}`)
          const apt = data.appointment ?? null
          if (apt) await storage.set(COLLECTION, key, apt)
          return apt
        } catch (error) {
          if (error instanceof DataClientHttpError) return null
          /* fall back to the offline snapshot */
        }
      }
      const cached = await storage.get<AppointmentWithDetails>(COLLECTION, key)
      return cached ?? null
    },

    refresh: fetchRange,

    hydrateRangeFromServer(startDate, endDate, appointments) {
      return persistRange(startDate, endDate, appointments)
    },

    rangeLastSyncedAt(startDate, endDate) {
      return readCacheTimestamp(storage, COLLECTION, rangeKey(startDate, endDate))
    },

    async create(input) {
      if (!mutationQueue || isOnline()) {
        const data = await transport.json<AppointmentOneResponse>('POST', '/api/appointments', {
          body: input,
        })
        await invalidateAllRanges()
        const apt = data.appointment
        await storage.set(COLLECTION, `one:${apt.id}`, apt)
        listeners.notify({ startDate: input.date, endDate: input.date, appointments: [apt] })
        return apt
      }

      const staff = await resolveStaffLocal(input.staffId)
      const service = await resolveServiceLocal(input.serviceId)
      if (!staff || !service) {
        throw new DataClientHttpError('اطلاعات پایه نوبت (پرسنل/خدمت) در حافظه محلی نیست', 400, {
          code: 'missing-reference',
        })
      }
      if ((input.addonIds?.length ?? 0) > 0) {
        throw new DataClientHttpError('رزرو افزودنی در حالت آفلاین هنوز در دسترس نیست', 400, {
          code: 'missing-reference',
        })
      }

      const localPlaceholderClient =
        input.placeholderClient != null
          ? ({
              id: newOfflineEntityId(),
              name: input.placeholderClient.name.trim(),
              phone: null,
              isPlaceholder: true,
              notes: input.placeholderClient.notes,
              createdAt: new Date(),
            } satisfies Client)
          : null
      if (localPlaceholderClient && !localPlaceholderClient.name) {
        throw new DataClientHttpError('نام مشتری موقت الزامی است', 400, {
          code: 'validation-error',
        })
      }

      const resolvedClient =
        localPlaceholderClient ??
        (input.clientId ? await resolveClientLocal(input.clientId) : null)
      if (!resolvedClient) {
        throw new DataClientHttpError('اطلاعات پایه نوبت (مشتری) در حافظه محلی نیست', 400, {
          code: 'missing-reference',
        })
      }

      const dur =
        typeof input.durationMinutes === 'number' && input.durationMinutes > 0
          ? input.durationMinutes
          : service.duration
      const resolvedEndTime =
        input.endTime && input.endTime.trim() !== ''
          ? input.endTime.trim()
          : endTimeFromDuration(input.startTime, dur)

      const win = validateAppointmentWindow(input.startTime, resolvedEndTime)
      if (!win.ok) {
        throw new DataClientHttpError(win.error, 400, { code: 'validation-error' })
      }

      const id = newOfflineEntityId()
      const candidate: AppointmentWithDetails = {
        id,
        clientId: resolvedClient.id,
        staffId: staff.id,
        serviceId: service.id,
        bookedServiceName: service.name,
        bookedServiceDuration: service.duration,
        bookedServicePrice: service.price,
        bookedTotalDuration: service.duration,
        bookedTotalPrice: service.price,
        bookedAddonCount: 0,
        bookedAddons: [],
        date: input.date,
        startTime: input.startTime,
        endTime: resolvedEndTime,
        status: 'scheduled',
        notes: input.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: resolvedClient,
        staff,
        service,
      }

      const rawSameDay = await loadRawRange(input.date, input.date)
      const mergedSameDay = await mergeOverlay(input.date, input.date, rawSameDay)
      const others = mergedSameDay.filter((a) => a.id !== id)
      assertPlaceholderSingleUse(candidate, others)
      assertNoOverlap(candidate, others)

      await mutationQueue.runAtomically(async (txQueue, txStorage) => {
        await txQueue.enqueue({
          entityType: 'appointment',
          entityId: id,
          operation: 'create',
          payload: {
            id,
            createInput: {
              ...(localPlaceholderClient
                ? {
                    placeholderClient: {
                      name: localPlaceholderClient.name,
                      notes: localPlaceholderClient.notes,
                    },
                  }
                : { clientId: input.clientId }),
              staffId: input.staffId,
              serviceId: input.serviceId,
              addonIds: input.addonIds,
              date: input.date,
              startTime: input.startTime,
              endTime: resolvedEndTime,
              durationMinutes: input.durationMinutes,
              notes: input.notes,
            },
            ...(localPlaceholderClient ? { localPlaceholderClientId: localPlaceholderClient.id } : {}),
            appointment: candidate,
            reviewMetadata: {
              action: 'create',
              appointmentId: candidate.id,
              appointmentDate: candidate.date,
              ...(localPlaceholderClient ? { placeholderClientId: localPlaceholderClient.id } : {}),
            },
          },
        })
        await txStorage.set(COLLECTION, `one:${id}`, candidate)
        if (localPlaceholderClient) {
          await updateClientListRecord(txStorage, localPlaceholderClient, false)
        }
      })

      listeners.notify({ startDate: input.date, endDate: input.date, appointments: [candidate] })
      return candidate
    },

    update: async (id, input) => {
      if (!mutationQueue || isOnline()) {
        return patchAppointment(id, input)
      }
      return performOfflineUpdate(id, input)
    },

    async completePlaceholderClient(id, input) {
      if (!mutationQueue || isOnline()) {
        const data = await transport.json<AppointmentCompletePlaceholderResponse>(
          'POST',
          `/api/appointments/${id}/complete-client`,
          {
            body: input,
          }
        )
        await invalidateAllRanges()
        await storage.clearCollection(LOCAL_COLLECTIONS.clients)
        const apt = data.appointment
        await storage.set(COLLECTION, `one:${apt.id}`, apt)
        listeners.notify({ startDate: apt.date, endDate: apt.date, appointments: [apt] })
        return apt
      }

      const current = await resolveCurrentAppointment(id)
      if (!current) {
        throw new DataClientHttpError('نوبت یافت نشد', 404, null)
      }
      if (!current.client.isPlaceholder) {
        throw new DataClientHttpError('این نوبت مشتری موقت ندارد', 400, null)
      }

      const normalizedPhone = normalizePhone(input.phone)
      const duplicateClient = await findLocalClientByPhone(normalizedPhone, current.clientId)
      if (
        duplicateClient &&
        input.reassignToExistingClientId !== duplicateClient.id
      ) {
        throw new DataClientHttpError('این شماره تماس برای مشتری دیگری ثبت شده است', 409, {
          code: 'duplicate-phone',
          existingClient: duplicateClient,
        })
      }

      const nextClient =
        duplicateClient ??
        ({
          ...current.client,
          name: input.name.trim(),
          phone: normalizedPhone,
          isPlaceholder: false,
          notes: input.notes,
        } satisfies Client)

      const next: AppointmentWithDetails = {
        ...current,
        clientId: nextClient.id,
        client: nextClient,
        updatedAt: new Date(),
      }

      const raw = await loadRawRange(next.date, next.date)
      const merged = await mergeOverlay(next.date, next.date, raw)
      const others = merged.filter((appointment) => appointment.id !== id)
      if (isBlockingAppointmentStatus(next.status)) {
        assertNoOverlap(next, others, id)
      }

      await mutationQueue.runAtomically(async (txQueue, txStorage) => {
        await txQueue.enqueue({
          entityType: 'appointment',
          entityId: id,
          operation: 'update',
          payload: {
            id,
            action: 'complete_placeholder_client',
            input: {
              ...input,
              phone: normalizedPhone,
            },
            appointment: next,
            reviewMetadata: {
              action: 'complete_placeholder_client',
              appointmentId: next.id,
              appointmentDate: next.date,
              placeholderClientId: current.clientId,
            },
          },
        })
        await txStorage.set(COLLECTION, `one:${id}`, next)
        if (duplicateClient) {
          await removeClientListRecord(txStorage, current.clientId)
        } else {
          await updateClientListRecord(txStorage, nextClient, true)
        }
      })

      listeners.notify({ startDate: next.date, endDate: next.date, appointments: [next] })
      return next
    },

    updateStatus: async (id, status) => {
      if (!mutationQueue || isOnline()) {
        return patchAppointment(id, { status })
      }
      return performOfflineUpdate(id, { status })
    },

    async remove(id: string) {
      if (!mutationQueue || isOnline()) {
        await transport.json<{ success: boolean }>('DELETE', `/api/appointments/${id}`)
        await invalidateAllRanges()
        return
      }

      const current = await resolveCurrentAppointment(id)
      const date = current?.date
      await mutationQueue.runAtomically(async (txQueue, txStorage) => {
        const enqueued = await txQueue.enqueue({
          entityType: 'appointment',
          entityId: id,
          operation: 'delete',
          payload: { id },
        })
        await txStorage.delete(COLLECTION, `one:${id}`)
        if (enqueued === null && current?.client.isPlaceholder) {
          await removeClientListRecord(txStorage, current.clientId)
        }
      })
      if (date) {
        listeners.notify({ startDate: date, endDate: date, appointments: [] })
      }
    },

    subscribe(fn) {
      return listeners.subscribe(fn)
    },
  }
}
