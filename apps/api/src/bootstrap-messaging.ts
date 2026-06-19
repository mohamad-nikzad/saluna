import {
  createBaleProvider,
  createTelegramProvider,
  initBaleSafir,
  initBaleMessaging,
  initSmsDelivery,
  initTelegramMessaging,
  registerMessagingProvider,
} from '@repo/notifications'

import {
  readBaleConfigFromEnv,
  readBaleSafirConfigFromEnv,
  readSmsDeliveryConfigFromEnv,
  readTelegramConfigFromEnv,
} from './env'

/** Registers messaging providers using API-validated environment configuration. */
export function bootstrapMessagingProviders(): void {
  const getTelegramConfig = () => readTelegramConfigFromEnv()
  const getBaleConfig = () => readBaleConfigFromEnv()
  const getBaleSafirConfig = () => readBaleSafirConfigFromEnv()
  const getSmsDeliveryConfig = () => readSmsDeliveryConfigFromEnv()
  initTelegramMessaging(getTelegramConfig)
  initBaleMessaging(getBaleConfig)
  initBaleSafir(getBaleSafirConfig)
  initSmsDelivery(getSmsDeliveryConfig)
  registerMessagingProvider(createTelegramProvider(getTelegramConfig))
  registerMessagingProvider(createBaleProvider(getBaleConfig))
}
