import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consumeLinkTokenIfValid: vi.fn(),
  findAccountByExternalId: vi.fn(),
  findAccountByUserAndProvider: vi.fn(),
  linkMessagingAccountAndEnableProvider: vi.fn(),
  deleteAccount: vi.fn(),
}))

vi.mock('@repo/database/messaging', () => ({
  consumeLinkTokenIfValid: mocks.consumeLinkTokenIfValid,
  findAccountByExternalId: mocks.findAccountByExternalId,
  findAccountByUserAndProvider: mocks.findAccountByUserAndProvider,
  linkMessagingAccountAndEnableProvider:
    mocks.linkMessagingAccountAndEnableProvider,
  deleteAccount: mocks.deleteAccount,
}))

import { handleLinkStart, handleUnlink } from './index'

const validToken = {
  token: 't1',
  userId: 'user-A',
  salonId: 's1',
  provider: 'telegram' as const,
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 60000),
  consumedAt: null,
}

beforeEach(() => {
  mocks.consumeLinkTokenIfValid.mockReset()
  mocks.findAccountByExternalId.mockReset()
  mocks.findAccountByUserAndProvider.mockReset()
  mocks.linkMessagingAccountAndEnableProvider.mockReset()
  mocks.deleteAccount.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('handleLinkStart', () => {
  it('rejects invalid/expired tokens', async () => {
    mocks.consumeLinkTokenIfValid.mockResolvedValue(undefined)
    const result = await handleLinkStart({
      provider: 'telegram',
      token: 'bad',
      externalId: '42',
      displayName: '@x',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.code).toBe('invalid_token')
    expect(mocks.linkMessagingAccountAndEnableProvider).not.toHaveBeenCalled()
  })

  it('refuses when the external_id already belongs to another user', async () => {
    mocks.consumeLinkTokenIfValid.mockResolvedValue(validToken)
    mocks.findAccountByExternalId.mockResolvedValue({
      id: 'acc-1',
      userId: 'user-B',
      provider: 'telegram',
      externalId: '42',
      displayName: null,
      enabled: true,
      linkedAt: new Date(),
      updatedAt: new Date(),
    })
    const result = await handleLinkStart({
      provider: 'telegram',
      token: 't1',
      externalId: '42',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.code).toBe('external_id_taken')
    expect(mocks.consumeLinkTokenIfValid).toHaveBeenCalledWith('t1', 'telegram')
    expect(mocks.linkMessagingAccountAndEnableProvider).not.toHaveBeenCalled()
  })

  it('links account on happy path', async () => {
    mocks.consumeLinkTokenIfValid.mockResolvedValue({
      ...validToken,
      consumedAt: new Date(),
    })
    mocks.findAccountByExternalId.mockResolvedValue(undefined)
    mocks.linkMessagingAccountAndEnableProvider.mockResolvedValue({
      id: 'acc-1',
      userId: 'user-A',
      provider: 'telegram',
      externalId: '42',
      displayName: '@x',
      enabled: true,
      linkedAt: new Date(),
      updatedAt: new Date(),
    })
    const result = await handleLinkStart({
      provider: 'telegram',
      token: 't1',
      externalId: '42',
      displayName: '@x',
    })
    expect(result.status).toBe('ok')
    expect(mocks.consumeLinkTokenIfValid).toHaveBeenCalledWith('t1', 'telegram')
    expect(mocks.linkMessagingAccountAndEnableProvider).toHaveBeenCalledWith({
      userId: 'user-A',
      salonId: 's1',
      provider: 'telegram',
      externalId: '42',
      displayName: '@x',
    })
  })
})

describe('handleUnlink', () => {
  it('returns not_linked when no account exists', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(undefined)
    const result = await handleUnlink({
      provider: 'telegram',
      externalId: '42',
    })
    expect(result.status).toBe('error')
  })

  it('deletes when an account exists', async () => {
    mocks.findAccountByExternalId.mockResolvedValue({
      id: 'acc-1',
      userId: 'user-A',
      provider: 'telegram',
      externalId: '42',
      displayName: null,
      enabled: true,
      linkedAt: new Date(),
      updatedAt: new Date(),
    })
    mocks.deleteAccount.mockResolvedValue(true)
    const result = await handleUnlink({
      provider: 'telegram',
      externalId: '42',
    })
    expect(result.status).toBe('ok')
    expect(mocks.deleteAccount).toHaveBeenCalledWith('acc-1', 'user-A')
  })
})
