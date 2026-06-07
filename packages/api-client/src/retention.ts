import type { ClientFollowUp, FollowUpStatus, RetentionItem } from '@repo/salon-core/types'
import type { ApiClient } from './client'
import { endpoints } from './endpoints'

export type RetentionQueueResponse = {
  items: RetentionItem[]
}

export type UpdateRetentionItemResponse = {
  followUp: ClientFollowUp
}

export type BaleRetentionMessageResponse = {
  delivery: {
    id: string
    provider: 'bale_safir'
    status: 'sent' | 'failed' | 'skipped'
    providerMessageId: string | null
    error: string | null
  }
  result: {
    status: 'sent' | 'failed' | 'skipped'
    providerMessageId?: string | null
    error?: string | null
    phone?: string | null
  }
}

export function createRetentionApi(client: ApiClient) {
  return {
    list(opts: { signal?: AbortSignal } = {}) {
      return client.request<RetentionQueueResponse>(endpoints.retention, {
        signal: opts.signal,
      })
    },
    updateStatus(
      id: string,
      status: FollowUpStatus,
      opts: { signal?: AbortSignal } = {},
    ) {
      return client.request<UpdateRetentionItemResponse>(
        `${endpoints.retention}/${id}`,
        {
          method: 'PATCH',
          body: { status },
          signal: opts.signal,
        },
      )
    },
    sendBaleMessage(id: string, opts: { retry?: boolean; signal?: AbortSignal } = {}) {
      return client.request<BaleRetentionMessageResponse>(
        `${endpoints.retention}/${id}/bale-message`,
        {
          method: 'POST',
          body: opts.retry ? { retry: true } : {},
          signal: opts.signal,
        },
      )
    },
  }
}

export type RetentionApi = ReturnType<typeof createRetentionApi>
