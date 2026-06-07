/**
 * Provider registration entry point. Per-provider modules register themselves
 * here at module load. Providers self-skip via `isConfigured()` when env is
 * missing, so registration is unconditional.
 */
export * from './registry'
export * from './types'

export {
  answerBaleCallback,
  createBaleProvider,
  editBaleMessageReplyMarkup,
  editBaleMessageText,
  escapeBaleMarkdown,
  getBaleConfig,
  initBaleMessaging,
  renderBaleBotHtml,
  renderBaleMarkdown,
  sendBaleMessage,
  setBaleFetchForTests,
  type BaleConfig,
} from './bale'

export {
  buildBaleSafirSendMessageRequest,
  getBaleSafirConfig,
  initBaleSafir,
  mapBaleSafirErrorCode,
  normalizeBaleSafirPhone,
  sendBaleSafirMessage,
  setBaleSafirFetchForTests,
  type BaleSafirButton,
  type BaleSafirConfig,
} from './bale-safir'

export {
  answerTelegramCallback,
  createTelegramProvider,
  editTelegramMessageReplyMarkup,
  editTelegramMessageText,
  escapeHtml,
  getTelegramConfig,
  initTelegramMessaging,
  sendTelegramMessage,
  type TelegramConfig,
} from './telegram'
export { registerMessagingProvider } from './registry'

export {
  REPLY_KEYBOARD_LABELS,
  persistentReplyKeyboard,
} from './telegram-keyboard'
