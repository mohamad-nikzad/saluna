export {
  isClientProvidedEntityId,
  createClient,
  createClientsBulk,
  deleteClient,
  getAllClients,
  getClientById,
  getClientByPhone,
  getClientTags,
  getClientTagsForClients,
  setClientTags,
  updateClient,
} from './internal/client-queries'
export { isDuplicatePhoneError } from './internal/db-errors'
export type {
  BulkCreateClientInput,
  BulkCreateClientSkipped,
  BulkCreateClientSkipReason,
  BulkCreateClientsResult,
} from './internal/client-queries'

export {
  cancelIncompletePlaceholderAppointment,
  cleanupPlaceholderAfterAppointmentMutation,
  createPlaceholderClient,
  deletePlaceholderClientIfOrphaned,
  completePlaceholderAppointmentClient,
  validatePlaceholderClientUsage,
} from './internal/placeholder-client-queries'

export {
  createClientFollowUpMessageDelivery,
  createClientFollowUp,
  getClientFollowUpMessageContext,
  getLatestClientFollowUpMessageDelivery,
  getClientFollowUps,
  getClientSummary,
  updateClientFollowUpStatus,
} from './internal/client-followup-queries'
export type {
  ClientFollowUpMessageContext,
  ClientFollowUpMessageDelivery,
} from './internal/client-followup-queries'
