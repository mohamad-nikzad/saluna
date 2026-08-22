export type { MessagingProviderId } from './messaging-provider-id'
export {
  checkMessagingLinkRateLimit,
  consumeLinkTokenIfValid,
  findValidLinkToken,
  createLinkToken,
  deleteAccount,
  findAccountByExternalId,
  findAccountByUserAndProvider,
  linkMessagingAccountAndEnableProvider,
  listAccountsForUser,
  setAccountEnabled,
  upsertAccount,
} from './internal/messaging-queries'
export type {
  CreateLinkTokenInput,
  MessagingLinkRateLimitResult,
  MessagingLinkToken,
  UpsertAccountInput,
  UserMessagingAccount,
} from './internal/messaging-queries'
