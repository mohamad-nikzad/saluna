import type { HttpTransportPort } from '../ports/http-transport'
import type { LocalDataPort } from '../ports/local-data-port'
import { createAppointmentsModule, type AppointmentsModule } from './modules/appointments-module'
import { createBusinessSettingsModule, type BusinessSettingsModule } from './modules/business-settings-module'
import { createClientsModule, type ClientsModule } from './modules/clients-module'
import { createServicesModule, type ServicesModule } from './modules/services-module'
import { createSessionModule, type SessionModule } from './modules/session-module'
import { createStaffModule, type StaffModule } from './modules/staff-module'
import { createSyncModule, type SyncModule } from './modules/sync-module'
import { createTodayModule, type TodayModule } from './modules/today-module'
import { NotifyingMutationQueue, type MutationQueuePort } from './mutation-queue'
import { defaultIsOnline, type OnlineStatusReader } from './online-status'

export interface DataClient {
  session: SessionModule
  staff: StaffModule
  services: ServicesModule
  businessSettings: BusinessSettingsModule
  clients: ClientsModule
  appointments: AppointmentsModule
  today: TodayModule
  sync: SyncModule
}

export function composeDataClient(input: {
  transport: HttpTransportPort
  storage: LocalDataPort
  mutationQueue?: MutationQueuePort | null
  isOnline?: OnlineStatusReader
}): DataClient {
  const { transport, storage } = input
  const innerQueue = input.mutationQueue ?? null
  const isOnline = input.isOnline ?? defaultIsOnline

  const syncHolder: { current: SyncModule | null } = { current: null }
  const mutationQueue =
    innerQueue !== null
      ? new NotifyingMutationQueue(innerQueue, () => {
          syncHolder.current?.notifyQueueChanged()
        })
      : null

  const session = createSessionModule(transport, storage, { isOnline })
  const getSalonId = () => session.get().then((u) => u?.salonId ?? null)

  const sync = createSyncModule({
    queue: mutationQueue,
    transport,
    storage,
    isOnline,
  })
  syncHolder.current = sync

  return {
    session,
    staff: createStaffModule(transport, storage, {
      mutationQueue,
      isOnline,
      getSalonId,
    }),
    services: createServicesModule(transport, storage, {
      mutationQueue,
      isOnline,
    }),
    businessSettings: createBusinessSettingsModule(transport, storage, {
      mutationQueue,
      isOnline,
    }),
    clients: createClientsModule(transport, storage, {
      mutationQueue,
      isOnline,
      getSalonId,
    }),
    appointments: createAppointmentsModule(transport, storage, {
      mutationQueue,
      isOnline,
    }),
    today: createTodayModule(transport, storage, { isOnline }),
    sync,
  }
}
