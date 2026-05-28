export { createDataClient, type CreateDataClientConfig, type DataClientPersistence } from './create-data-client'
export type { DataClient } from './core/compose-data-client'
export { composeDataClient } from './core/compose-data-client'
export { createFetchHttpTransport, type CreateFetchHttpTransportOptions } from './adapters/http/fetch-http-transport'
export { IndexedDbLocalDataPort } from './adapters/indexeddb/indexed-db-local-data-port'
export { SalonOfflineDexie } from './adapters/indexeddb/salon-offline-db'
export { MemoryLocalDataPort } from './adapters/memory/memory-local-data-port'
export { NullLocalDataPort } from './ports/local-data-port'
export { DataClientHttpError, type HttpTransportPort, type HttpMethod } from './ports/http-transport'
export type { LocalDataPort } from './ports/local-data-port'
export type { SessionModule } from './core/modules/session-module'
export type {
  StaffModule,
  StaffScheduleBundle,
  StaffScheduleDayDraft,
} from './core/modules/staff-module'
export type {
  ServicesModule,
  ServiceAddonCreateInput,
  ServiceAddonScopeInput,
  ServiceAddonUpdateInput,
  ServiceCreateInput,
  ServiceUpdateInput,
  ApplyCatalogPresetSelection,
  CatalogPresetListItem,
} from './core/modules/services-module'
export type { BusinessSettingsModule, BusinessSettingsUpdateInput } from './core/modules/business-settings-module'
export { BUSINESS_SETTINGS_ENTITY_ID } from './core/modules/business-settings-module'
export type { ClientsModule, ClientCreateInput, ClientUpdateInput } from './core/modules/clients-module'
export type {
  AppointmentsModule,
  AppointmentCreateInput,
  AppointmentCompletePlaceholderClientInput,
  AppointmentMutationResult,
  AppointmentUpdateInput,
  PlaceholderClientDraft,
} from './core/modules/appointments-module'
export type { TodayModule } from './core/modules/today-module'
export type { SyncModule, SyncReviewItem, SyncState } from './core/modules/sync-module'
export { httpErrorCode, isAuthHttpError, isServerConflictError } from './core/sync-http-error'
export type { MutationEntityType, MutationQueueRow } from './core/mutation-queue'
