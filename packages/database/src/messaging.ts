export {
  consumeLinkToken,
  createLinkToken,
  deleteAccount,
  findAccountByExternalId,
  findAccountByUserAndProvider,
  listAccountsForUser,
  setAccountEnabled,
  upsertAccount,
} from './internal/messaging-queries'
export type {
  CreateLinkTokenInput,
  MessagingLinkToken,
  MessagingProviderId,
  UpsertAccountInput,
  UserMessagingAccount,
} from './internal/messaging-queries'
