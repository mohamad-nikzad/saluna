import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findAccountByExternalId: vi.fn(),
  getAppointmentRequestForCallback: vi.fn(),
  approveAppointmentRequest: vi.fn(),
  rejectAppointmentRequest: vi.fn(),
  getMemberForUser: vi.fn(),
  listCapableStaffForService: vi.fn(),
  salonCurrentHm: vi.fn(() => '14:32'),
}))

vi.mock('@repo/database/messaging', () => ({
  findAccountByExternalId: mocks.findAccountByExternalId,
}))

vi.mock('@repo/database/appointment-requests', () => ({
  approveAppointmentRequest: mocks.approveAppointmentRequest,
  rejectAppointmentRequest: mocks.rejectAppointmentRequest,
  getAppointmentRequestForCallback: mocks.getAppointmentRequestForCallback,
}))

vi.mock('@repo/database/members', () => ({
  getMemberForUser: mocks.getMemberForUser,
}))

vi.mock('@repo/database/staff', () => ({
  listCapableStaffForService: mocks.listCapableStaffForService,
}))

vi.mock('@repo/salon-core/salon-local-time', () => ({
  salonCurrentHm: mocks.salonCurrentHm,
}))

import {
  handleApprovalCallback,
  handleAssignCallback,
  handleBackCallback,
  handleRejectionCallback,
} from './approval'

const linkedAccount = {
  id: 'acc-1',
  userId: 'mgr-1',
  provider: 'telegram' as const,
  externalId: '42',
  displayName: '@mo',
  enabled: true,
  linkedAt: new Date(),
  updatedAt: new Date(),
}

const pendingRequest = {
  requestId: 'req-1',
  salonId: 'salon-1',
  status: 'pending' as const,
  serviceId: 'svc-1',
  customerName: 'Roya',
  requestedDate: '2026-06-02',
  requestedStartTime: '10:00',
}

const managerMember = {
  userId: 'mgr-1',
  organizationId: 'salon-1',
  role: 'owner',
  name: 'مهدی',
  username: '09120000000',
}

beforeEach(() => {
  Object.values(mocks).forEach(
    (m) => 'mockReset' in m && (m as { mockReset: () => void }).mockReset(),
  )
  mocks.salonCurrentHm.mockReturnValue('14:32')
})

afterEach(() => vi.clearAllMocks())

describe('handleApprovalCallback', () => {
  it('approves when one capable staff exists', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(linkedAccount)
    mocks.getAppointmentRequestForCallback.mockResolvedValue(pendingRequest)
    mocks.getMemberForUser.mockResolvedValue(managerMember)
    mocks.listCapableStaffForService.mockResolvedValue([
      { id: 'staff-99', name: 'سارا' },
    ])
    mocks.approveAppointmentRequest.mockResolvedValue({
      ok: true,
      appointmentId: 'apt-1',
      clientId: 'cli-1',
    })

    const outcome = await handleApprovalCallback({
      provider: 'telegram',
      externalId: '42',
      requestId: 'req-1',
    })

    expect(mocks.approveAppointmentRequest).toHaveBeenCalledWith({
      id: 'req-1',
      salonId: 'salon-1',
      staffId: 'staff-99',
      reviewedByUserId: 'mgr-1',
    })
    expect(outcome.messageHtml).toContain('✅')
    expect(outcome.messageHtml).toContain('مهدی')
    expect(outcome.messageHtml).toContain('14:32')
    expect(outcome.replacementKeyboard).toBeNull()
    expect(outcome.toast).toBe('تأیید شد')
  })

  it('returns needs_app when no staff are capable', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(linkedAccount)
    mocks.getAppointmentRequestForCallback.mockResolvedValue(pendingRequest)
    mocks.getMemberForUser.mockResolvedValue(managerMember)
    mocks.listCapableStaffForService.mockResolvedValue([])

    const outcome = await handleApprovalCallback({
      provider: 'telegram',
      externalId: '42',
      requestId: 'req-1',
      publicAppBaseUrl: 'https://app.example',
    })

    expect(mocks.approveAppointmentRequest).not.toHaveBeenCalled()
    expect(outcome.messageHtml).toContain('برنامه')
    expect(outcome.replacementKeyboard).toEqual([
      [
        {
          label: 'مشاهده در برنامه',
          url: 'https://app.example/requests?focus=req-1',
        },
      ],
    ])
  })

  it('expands to a staff picker (markup-only) when multiple staff are capable', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(linkedAccount)
    mocks.getAppointmentRequestForCallback.mockResolvedValue(pendingRequest)
    mocks.getMemberForUser.mockResolvedValue(managerMember)
    mocks.listCapableStaffForService.mockResolvedValue([
      { id: 'staff-1', name: 'سارا' },
      { id: 'staff-2', name: 'نگار' },
    ])

    const outcome = await handleApprovalCallback({
      provider: 'telegram',
      externalId: '42',
      requestId: 'req-1',
      publicAppBaseUrl: 'https://app.example',
    })

    expect(mocks.approveAppointmentRequest).not.toHaveBeenCalled()
    expect(outcome.mode).toBe('markup')
    // N staff rows + 1 back/open-in-app row
    expect(outcome.replacementKeyboard).toEqual([
      [{ label: 'سارا', data: 'asg:req-1:0' }],
      [{ label: 'نگار', data: 'asg:req-1:1' }],
      [
        { label: '↩️ بازگشت', data: 'back:req-1' },
        {
          label: 'مشاهده در برنامه',
          url: 'https://app.example/requests?focus=req-1',
        },
      ],
    ])
  })

  it('short-circuits when the request is no longer pending', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(linkedAccount)
    mocks.getAppointmentRequestForCallback.mockResolvedValue({
      ...pendingRequest,
      status: 'approved' as const,
    })
    mocks.getMemberForUser.mockResolvedValue(managerMember)

    const outcome = await handleApprovalCallback({
      provider: 'telegram',
      externalId: '42',
      requestId: 'req-1',
    })

    expect(outcome.messageHtml).toContain('قبلاً')
    expect(outcome.replacementKeyboard).toBeNull()
    expect(mocks.approveAppointmentRequest).not.toHaveBeenCalled()
  })

  it('forbids callers who are not managers of the request salon', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(linkedAccount)
    mocks.getAppointmentRequestForCallback.mockResolvedValue(pendingRequest)
    mocks.getMemberForUser.mockResolvedValue({
      ...managerMember,
      organizationId: 'other-salon',
    })

    const outcome = await handleApprovalCallback({
      provider: 'telegram',
      externalId: '42',
      requestId: 'req-1',
    })

    expect(outcome.toast).toBe('دسترسی ندارید')
    expect(mocks.approveAppointmentRequest).not.toHaveBeenCalled()
  })

  it('returns not-linked when no messaging account exists', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(undefined)
    const outcome = await handleApprovalCallback({
      provider: 'telegram',
      externalId: '42',
      requestId: 'req-1',
    })
    expect(outcome.toast).toBe('حساب متصل نیست')
  })

  it('translates a 409 from approveAppointmentRequest into a recoverable open-in-app message', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(linkedAccount)
    mocks.getAppointmentRequestForCallback.mockResolvedValue(pendingRequest)
    mocks.getMemberForUser.mockResolvedValue(managerMember)
    mocks.listCapableStaffForService.mockResolvedValue([
      { id: 'staff-99', name: 'سارا' },
    ])
    mocks.approveAppointmentRequest.mockResolvedValue({
      ok: false,
      status: 409,
      error: 'slot taken',
    })

    const outcome = await handleApprovalCallback({
      provider: 'telegram',
      externalId: '42',
      requestId: 'req-1',
      publicAppBaseUrl: 'https://app.example',
    })

    expect(outcome.replacementKeyboard).not.toBeNull()
    expect(outcome.toast).toBe('تأیید ممکن نیست')
  })
})

describe('handleRejectionCallback', () => {
  it('rejects on the happy path', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(linkedAccount)
    mocks.getAppointmentRequestForCallback.mockResolvedValue(pendingRequest)
    mocks.getMemberForUser.mockResolvedValue(managerMember)
    mocks.rejectAppointmentRequest.mockResolvedValue({ ok: true })

    const outcome = await handleRejectionCallback({
      provider: 'telegram',
      externalId: '42',
      requestId: 'req-1',
    })

    expect(mocks.rejectAppointmentRequest).toHaveBeenCalledWith({
      id: 'req-1',
      salonId: 'salon-1',
      reviewedByUserId: 'mgr-1',
      reason: 'rejected via Telegram',
    })
    expect(outcome.messageHtml).toContain('❌')
    expect(outcome.replacementKeyboard).toBeNull()
    expect(outcome.toast).toBe('رد شد')
  })

  it('reports a race-safe message when the request flipped concurrently', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(linkedAccount)
    mocks.getAppointmentRequestForCallback.mockResolvedValue(pendingRequest)
    mocks.getMemberForUser.mockResolvedValue(managerMember)
    mocks.rejectAppointmentRequest.mockResolvedValue({
      ok: false,
      status: 409,
      error: 'not rejectable',
    })

    const outcome = await handleRejectionCallback({
      provider: 'telegram',
      externalId: '42',
      requestId: 'req-1',
    })

    expect(outcome.toast).toBe('رد ممکن نیست')
  })
})

describe('handleAssignCallback', () => {
  it('approves with the staff at the given index', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(linkedAccount)
    mocks.getAppointmentRequestForCallback.mockResolvedValue(pendingRequest)
    mocks.getMemberForUser.mockResolvedValue(managerMember)
    mocks.listCapableStaffForService.mockResolvedValue([
      { id: 'staff-1', name: 'سارا' },
      { id: 'staff-2', name: 'نگار' },
    ])
    mocks.approveAppointmentRequest.mockResolvedValue({
      ok: true,
      appointmentId: 'apt-1',
    })

    const outcome = await handleAssignCallback({
      provider: 'telegram',
      externalId: '42',
      requestId: 'req-1',
      staffIndex: 1,
    })

    expect(mocks.approveAppointmentRequest).toHaveBeenCalledWith({
      id: 'req-1',
      salonId: 'salon-1',
      staffId: 'staff-2',
      reviewedByUserId: 'mgr-1',
    })
    expect(outcome.messageHtml).toContain('✅')
    expect(outcome.replacementKeyboard).toBeNull()
    expect(outcome.mode).toBeUndefined()
    expect(outcome.toast).toBe('تأیید شد')
  })

  it('falls back to open-in-app when the index is out of range', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(linkedAccount)
    mocks.getAppointmentRequestForCallback.mockResolvedValue(pendingRequest)
    mocks.getMemberForUser.mockResolvedValue(managerMember)
    mocks.listCapableStaffForService.mockResolvedValue([
      { id: 'staff-1', name: 'سارا' },
    ])

    const outcome = await handleAssignCallback({
      provider: 'telegram',
      externalId: '42',
      requestId: 'req-1',
      staffIndex: 5,
      publicAppBaseUrl: 'https://app.example',
    })

    expect(mocks.approveAppointmentRequest).not.toHaveBeenCalled()
    expect(outcome.toast).toBe('انتخاب پرسنل نامعتبر است')
    expect(outcome.replacementKeyboard).toEqual([
      [
        {
          label: 'مشاهده در برنامه',
          url: 'https://app.example/requests?focus=req-1',
        },
      ],
    ])
  })
})

describe('handleBackCallback', () => {
  it('restores the original approve/reject/open-in-app keyboard (markup-only)', async () => {
    mocks.findAccountByExternalId.mockResolvedValue(linkedAccount)
    mocks.getAppointmentRequestForCallback.mockResolvedValue(pendingRequest)
    mocks.getMemberForUser.mockResolvedValue(managerMember)

    const outcome = await handleBackCallback({
      provider: 'telegram',
      externalId: '42',
      requestId: 'req-1',
      publicAppBaseUrl: 'https://app.example',
    })

    expect(mocks.approveAppointmentRequest).not.toHaveBeenCalled()
    expect(outcome.mode).toBe('markup')
    expect(outcome.replacementKeyboard).toEqual([
      [
        { label: '✅ تأیید', data: 'approve:req-1' },
        { label: '❌ رد', data: 'reject:req-1' },
      ],
      [
        {
          label: 'مشاهده در برنامه',
          url: 'https://app.example/requests?focus=req-1',
        },
      ],
    ])
  })
})
