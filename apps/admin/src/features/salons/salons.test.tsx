import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { renderAdminRoute } from '#/test/render-with-search-route'

const generated = vi.hoisted(() => ({
  listSalons: vi.fn(),
  getSalon: vi.fn(),
  getNotes: vi.fn(),
  getClients: vi.fn(),
  getAppointments: vi.fn(),
  getAppointmentRequests: vi.fn(),
  getStaff: vi.fn(),
  getServices: vi.fn(),
  getSetup: vi.fn(),
  getSetupCatalog: vi.fn(),
  getSetupStaff: vi.fn(),
  mutateSetupStaff: vi.fn(),
  mutateSetupCatalog: vi.fn(),
  createSetupClient: vi.fn(),
  previewSetupClientImport: vi.fn(),
  importSetupClients: vi.fn(),
  patchSetupHours: vi.fn(),
  patchSetupPresence: vi.fn(),
  patchSetupOwnerPhone: vi.fn(),
  createSetupHandoff: vi.fn(),
  patchStatus: vi.fn(),
  postSalon: vi.fn(),
  postNote: vi.fn(),
  authMe: vi.fn(),
}))

function mockAuthMe(
  options: {
    dataSource?: 'local' | 'live'
    role?:
      | 'platform_owner'
      | 'platform_admin'
      | 'platform_support'
      | 'platform_viewer'
  } = {},
) {
  generated.authMe.mockResolvedValue({
    user: {
      id: 'admin-user-id',
      userId: 'admin-user-id',
      name: 'Platform Owner',
      email: 'owner@saluna.test',
      phoneNumber: '+989120000000',
      username: 'owner',
      role: options.role ?? 'platform_owner',
      active: true,
    },
    runtime: { dataSource: options.dataSource ?? 'local' },
  })
}

function renderSalonsList() {
  mockAuthMe()
  return renderAdminRoute('/salons')
}

function renderSalonDetail(
  initialEntry: string,
  options: { dataSource?: 'local' | 'live' } = {},
) {
  mockAuthMe(options)
  return renderAdminRoute(initialEntry)
}

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      to,
      params,
      children,
    }: {
      to: string
      params?: Record<string, string>
      children: ReactNode
    }) => {
      const href = params?.salonId ? to.replace('$salonId', params.salonId) : to
      return <a href={href}>{children}</a>
    },
  }
})

vi.mock('@repo/api-client/query', () => ({
  getAdminSupportTicketSummaryOptions: () => ({
    queryKey: [{ _id: 'getAdminSupportTicketSummary' }],
    queryFn: () => new Promise(() => undefined),
  }),
  getApiV1AdminAuthMeOptions: () => ({
    queryKey: ['admin-auth-me-test'],
    queryFn: () => generated.authMe(),
  }),
  getApiV1AdminOverviewQueryKey: () => [{ _id: 'overview' }],
  getApiV1AdminSalonsQueryKey: () => [{ _id: 'salons' }],
  getApiV1AdminSalonsByIdQueryKey: (options: unknown) => [
    { _id: 'salon-detail', options },
  ],
  getApiV1AdminSalonsByIdNotesQueryKey: (options: unknown) => [
    { _id: 'salon-notes', options },
  ],
  getApiV1AdminSalonsOptions: (options: unknown) => ({
    queryKey: ['salons', options],
    queryFn: () => generated.listSalons(options),
  }),
  getApiV1AdminSalonsByIdOptions: (options: unknown) => ({
    queryKey: ['salon-detail', options],
    queryFn: () => generated.getSalon(options),
  }),
  getApiV1AdminSalonsByIdNotesOptions: (options: unknown) => ({
    queryKey: ['salon-notes', options],
    queryFn: () => generated.getNotes(options),
  }),
  getApiV1AdminSalonsByIdSetupOptions: (options: unknown) => ({
    queryKey: ['salon-setup', options],
    queryFn: () => generated.getSetup(options),
  }),
  getApiV1AdminSalonsByIdSetupQueryKey: (options: unknown) => [
    { _id: 'salon-setup', options },
  ],
  getApiV1AdminSalonsByIdSetupCatalogOptions: (options: unknown) => ({
    queryKey: ['salon-setup-catalog', options],
    queryFn: () => generated.getSetupCatalog(options),
  }),
  getApiV1AdminSalonsByIdSetupCatalogQueryKey: (options: unknown) => [
    { _id: 'salon-setup-catalog', options },
  ],
  getApiV1AdminSalonsByIdSetupStaffOptions: (options: unknown) => ({
    queryKey: ['salon-setup-staff', options],
    queryFn: () => generated.getSetupStaff(options),
  }),
  getApiV1AdminSalonsByIdSetupStaffQueryKey: (options: unknown) => [
    { _id: 'salon-setup-staff', options },
  ],
  getApiV1AdminSalonsByIdClientsOptions: (options: unknown) => ({
    queryKey: ['salon-clients', options],
    queryFn: () => generated.getClients(options),
  }),
  getApiV1AdminSalonsByIdClientsQueryKey: (options: unknown) => [
    { _id: 'salon-clients', options },
  ],
  getApiV1AdminSalonsByIdAppointmentsOptions: (options: unknown) => ({
    queryKey: ['salon-appointments', options],
    queryFn: () => generated.getAppointments(options),
  }),
  getApiV1AdminSalonsByIdAppointmentRequestsOptions: (options: unknown) => ({
    queryKey: ['salon-appointment-requests', options],
    queryFn: () => generated.getAppointmentRequests(options),
  }),
  getApiV1AdminSalonsByIdStaffOptions: (options: unknown) => ({
    queryKey: ['salon-staff', options],
    queryFn: () => generated.getStaff(options),
  }),
  getApiV1AdminSalonsByIdServicesOptions: (options: unknown) => ({
    queryKey: ['salon-services', options],
    queryFn: () => generated.getServices(options),
  }),
  patchApiV1AdminSalonsByIdStatusMutation: () => ({
    mutationFn: generated.patchStatus,
  }),
  patchApiV1AdminSalonsByIdSetupHoursMutation: () => ({
    mutationFn: generated.patchSetupHours,
  }),
  patchApiV1AdminSalonsByIdSetupPresenceMutation: () => ({
    mutationFn: generated.patchSetupPresence,
  }),
  patchApiV1AdminSalonsByIdSetupOwnerPhoneMutation: () => ({
    mutationFn: generated.patchSetupOwnerPhone,
  }),
  postApiV1AdminSalonsByIdSetupHandoffMutation: () => ({
    mutationFn: generated.createSetupHandoff,
  }),
  postApiV1AdminSalonsByIdSetupCatalogPresetsByPresetIdApplyMutation: () => ({
    mutationFn: generated.mutateSetupCatalog,
  }),
  postApiV1AdminSalonsByIdSetupCatalogCategoriesMutation: () => ({
    mutationFn: generated.mutateSetupCatalog,
  }),
  patchApiV1AdminSalonsByIdSetupCatalogCategoriesByEntityIdMutation: () => ({
    mutationFn: generated.mutateSetupCatalog,
  }),
  postApiV1AdminSalonsByIdSetupCatalogFamiliesMutation: () => ({
    mutationFn: generated.mutateSetupCatalog,
  }),
  patchApiV1AdminSalonsByIdSetupCatalogFamiliesByEntityIdMutation: () => ({
    mutationFn: generated.mutateSetupCatalog,
  }),
  postApiV1AdminSalonsByIdSetupCatalogServicesMutation: () => ({
    mutationFn: generated.mutateSetupCatalog,
  }),
  patchApiV1AdminSalonsByIdSetupCatalogServicesByEntityIdMutation: () => ({
    mutationFn: generated.mutateSetupCatalog,
  }),
  postApiV1AdminSalonsByIdSetupCatalogAddonsMutation: () => ({
    mutationFn: generated.mutateSetupCatalog,
  }),
  postApiV1AdminSalonsByIdSetupStaffMutation: () => ({
    mutationFn: generated.mutateSetupStaff,
  }),
  postApiV1AdminSalonsByIdSetupClientsMutation: () => ({
    mutationFn: generated.createSetupClient,
  }),
  postApiV1AdminSalonsByIdSetupClientsImportPreviewMutation: () => ({
    mutationFn: generated.previewSetupClientImport,
  }),
  postApiV1AdminSalonsByIdSetupClientsImportMutation: () => ({
    mutationFn: generated.importSetupClients,
  }),
  patchApiV1AdminSalonsByIdSetupCatalogAddonsByEntityIdMutation: () => ({
    mutationFn: generated.mutateSetupCatalog,
  }),
  postApiV1AdminSalonsMutation: () => ({
    mutationFn: generated.postSalon,
  }),
  postApiV1AdminSalonsByIdNotesMutation: () => ({
    mutationFn: generated.postNote,
  }),
}))

const salonId = '11111111-1111-4111-8111-111111111111'

describe('salons feature', () => {
  beforeEach(() => {
    generated.listSalons.mockReset()
    generated.getSalon.mockReset()
    generated.getNotes.mockReset()
    generated.getClients.mockReset()
    generated.getAppointments.mockReset()
    generated.getAppointmentRequests.mockReset()
    generated.getStaff.mockReset()
    generated.getServices.mockReset()
    generated.getSetup.mockReset()
    generated.getSetupCatalog.mockReset()
    generated.getSetupStaff.mockReset()
    generated.getSetupStaff.mockResolvedValue({ staff: [] })
    generated.mutateSetupStaff.mockReset()
    generated.getSetupCatalog.mockResolvedValue({
      categories: [],
      families: [],
      services: [],
      addons: [],
      presets: [],
    })
    generated.mutateSetupCatalog.mockReset()
    generated.createSetupClient.mockReset()
    generated.previewSetupClientImport.mockReset()
    generated.importSetupClients.mockReset()
    generated.patchSetupHours.mockReset()
    generated.patchSetupPresence.mockReset()
    generated.patchSetupOwnerPhone.mockReset()
    generated.createSetupHandoff.mockReset()
    generated.patchStatus.mockReset()
    generated.postSalon.mockReset()
    generated.postNote.mockReset()
    mockAuthMe()
    generated.getClients.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0 },
    })
    generated.getAppointments.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0 },
    })
    generated.getAppointmentRequests.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0 },
    })
    generated.getStaff.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0 },
    })
    generated.getServices.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0 },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders a searchable paginated salon table from generated salon query options', async () => {
    generated.listSalons.mockResolvedValue({
      items: [
        {
          id: salonId,
          name: 'Sun Salon',
          slug: 'aftab',
          status: 'active',
          phone: '+989121234567',
          memberCount: 3,
          publicEnabled: true,
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    })

    await renderSalonsList()

    expect(await screen.findByText('Sun Salon')).toBeTruthy()
    expect(screen.getByText('aftab')).toBeTruthy()
    expect(screen.getAllByText('فعال').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('link', { name: /مشاهده/ }).getAttribute('href'),
    ).toBe('/salons/11111111-1111-4111-8111-111111111111')
    expect(generated.listSalons).toHaveBeenCalledWith({
      query: { page: 1, pageSize: 20, search: undefined },
    })
  })

  it('distinguishes Setup Salons and creates one from the owner-only action', async () => {
    generated.listSalons.mockResolvedValue({
      items: [
        {
          id: salonId,
          name: 'Setup Aftab',
          slug: `setup-${salonId}`,
          status: 'setup',
          intendedOwnerPhone: '09121234567',
          memberCount: 0,
          publicEnabled: false,
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    })
    generated.postSalon.mockResolvedValue({
      salon: { id: salonId },
      ownerConflict: null,
    })

    renderSalonsList()

    expect(await screen.findByText('راه‌اندازی')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'سالن راه‌اندازی جدید' }),
    )
    fireEvent.change(screen.getByLabelText('نام سالن'), {
      target: { value: 'Setup Aftab' },
    })
    fireEvent.change(screen.getByLabelText('شماره تلفن مالک موردنظر'), {
      target: { value: '+98 912 123 4567' },
    })
    fireEvent.change(screen.getByLabelText('دلیل'), {
      target: { value: 'Signed agreement' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'ایجاد سالن راه‌اندازی' }),
    )

    await waitFor(() => expect(generated.postSalon).toHaveBeenCalled())
    expect(generated.postSalon.mock.calls[0]?.[0]).toEqual({
      body: {
        name: 'Setup Aftab',
        intendedOwnerPhone: '+98 912 123 4567',
        reason: 'Signed agreement',
        liveConfirmation: undefined,
      },
    })
  })

  it('hides the Setup Salon mutation from platform support', async () => {
    generated.listSalons.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    })
    mockAuthMe({ role: 'platform_support' })

    renderAdminRoute('/salons')

    await waitFor(() => expect(generated.listSalons).toHaveBeenCalled())
    expect(
      screen.queryByRole('button', { name: 'سالن راه‌اندازی جدید' }),
    ).toBeNull()
  })

  it('shows Setup status and intended-owner phone in salon detail', async () => {
    generated.getSalon.mockResolvedValue({
      salon: {
        id: salonId,
        name: 'Setup Aftab',
        status: 'setup',
        intendedOwnerPhone: '09121234567',
        publicEnabled: false,
      },
      members: [],
      stats: { services: 0, appointments: 0 },
    })
    generated.getNotes.mockResolvedValue({ notes: [] })

    renderSalonDetail(`/salons/${salonId}`)

    expect(await screen.findByText('راه‌اندازی')).toBeTruthy()
    expect(screen.getByText('09121234567')).toBeTruthy()
    expect(screen.getByText('تلفن مالک موردنظر')).toBeTruthy()
  })

  it('edits Setup Salon hours and presence while preserving entered values on failures', async () => {
    generated.getSalon.mockResolvedValue({
      salon: {
        id: salonId,
        name: 'Setup Aftab',
        status: 'setup',
        intendedOwnerPhone: '09121234567',
        publicEnabled: false,
      },
      members: [],
      stats: { services: 0, appointments: 0 },
    })
    generated.getNotes.mockResolvedValue({ notes: [] })
    generated.getSetup.mockResolvedValue({
      hours: {
        workingStart: '09:00',
        workingEnd: '19:00',
        slotDurationMinutes: 30,
        workingDays: 126,
      },
      presence: {
        address: 'Old address',
        mapGoogle: null,
        mapNeshan: null,
        mapBalad: null,
        socialInstagram: null,
        socialTelegram: null,
        socialWhatsapp: null,
        website: null,
      },
    })
    generated.patchSetupHours.mockRejectedValue(
      new Error('ساعت پایان نامعتبر است'),
    )
    generated.patchSetupPresence.mockResolvedValue({ presence: {} })

    await renderSalonDetail(`/salons/${salonId}?tab=setup`)

    expect(await screen.findByText('روزها و ساعت کاری')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('ساعت باز شدن'), {
      target: { value: '10:00' },
    })
    fireEvent.change(screen.getAllByLabelText('دلیل تغییر')[0]!, {
      target: { value: 'Prepare salon hours' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره ساعت کاری' }))

    await waitFor(() => expect(generated.patchSetupHours).toHaveBeenCalled())
    expect(generated.patchSetupHours.mock.calls[0]?.[0]).toEqual({
      path: { id: salonId },
      body: {
        workingStart: '10:00',
        workingEnd: '19:00',
        slotDurationMinutes: 30,
        workingDays: 126,
        reason: 'Prepare salon hours',
        liveConfirmation: undefined,
      },
    })
    expect(await screen.findByText('ساعت پایان نامعتبر است')).toBeTruthy()
    expect(
      (screen.getByLabelText('ساعت باز شدن') as HTMLInputElement).value,
    ).toBe('10:00')

    fireEvent.change(screen.getByLabelText('آدرس'), {
      target: { value: 'New address' },
    })
    fireEvent.change(screen.getAllByLabelText('دلیل تغییر')[1]!, {
      target: { value: 'Prepare salon presence' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره حضور سالن' }))

    await waitFor(() => expect(generated.patchSetupPresence).toHaveBeenCalled())
    expect(generated.patchSetupPresence.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        path: { id: salonId },
        body: expect.objectContaining({
          address: 'New address',
          reason: 'Prepare salon presence',
        }),
      }),
    )
  })

  it('applies a preset and creates catalog records in the Setup Salon workspace', async () => {
    generated.getSalon.mockResolvedValue({
      salon: { id: salonId, name: 'Setup Aftab', status: 'setup' },
      members: [],
      stats: { services: 0, appointments: 0 },
    })
    generated.getNotes.mockResolvedValue({ notes: [] })
    generated.getSetup.mockResolvedValue({
      hours: {
        workingStart: '09:00',
        workingEnd: '19:00',
        slotDurationMinutes: 30,
        workingDays: 126,
      },
      presence: {
        address: null,
        mapGoogle: null,
        mapNeshan: null,
        mapBalad: null,
        socialInstagram: null,
        socialTelegram: null,
        socialWhatsapp: null,
        website: null,
      },
    })
    generated.getSetupCatalog.mockResolvedValue({
      categories: [],
      families: [],
      services: [],
      addons: [],
      presets: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'قالب مو',
          tree: [{ families: [{ variants: [{ name: 'رنگ مو' }] }] }],
        },
      ],
    })
    generated.mutateSetupCatalog.mockResolvedValue({})

    await renderSalonDetail(`/salons/${salonId}?tab=setup`)

    const categoryName = await screen.findByLabelText('دسته جدید')
    const categoryForm = categoryName.closest('form')!
    fireEvent.change(categoryName, { target: { value: 'مو' } })
    fireEvent.change(categoryForm.querySelector('[name="reason"]')!, {
      target: { value: 'Prepare categories' },
    })
    fireEvent.submit(categoryForm)

    await waitFor(() => expect(generated.mutateSetupCatalog).toHaveBeenCalled())
    expect(generated.mutateSetupCatalog.mock.calls[0]?.[0]).toEqual({
      path: { id: salonId },
      body: {
        name: 'مو',
        active: true,
        reason: 'Prepare categories',
      },
    })

    const presetButton = screen.getByRole('button', {
      name: 'اعمال همه خدمات قالب',
    })
    const presetForm = presetButton.closest('form')!
    fireEvent.change(presetForm.querySelector('[name="reason"]')!, {
      target: { value: 'Use starter preset' },
    })
    fireEvent.click(presetButton)

    await waitFor(() =>
      expect(generated.mutateSetupCatalog).toHaveBeenCalledTimes(2),
    )
    expect(generated.mutateSetupCatalog.mock.calls[1]?.[0]).toEqual({
      path: {
        id: salonId,
        presetId: '22222222-2222-4222-8222-222222222222',
      },
      body: {
        selection: [
          {
            categoryIndex: 0,
            families: [{ familyIndex: 0, variantIndices: [0] }],
          },
        ],
        reason: 'Use starter preset',
      },
    })
  })

  it('creates a scheduled unclaimed Staff Profile without asking for credentials', async () => {
    generated.getSalon.mockResolvedValue({
      salon: { id: salonId, name: 'Setup Aftab', status: 'setup' },
      members: [],
      stats: { services: 1, appointments: 0 },
    })
    generated.getNotes.mockResolvedValue({ notes: [] })
    generated.getSetup.mockResolvedValue({
      hours: {
        workingStart: '09:00',
        workingEnd: '19:00',
        slotDurationMinutes: 30,
        workingDays: 126,
      },
      presence: {
        address: null,
        mapGoogle: null,
        mapNeshan: null,
        mapBalad: null,
        socialInstagram: null,
        socialTelegram: null,
        socialWhatsapp: null,
        website: null,
      },
    })
    generated.getSetupCatalog.mockResolvedValue({
      categories: [],
      families: [],
      services: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'رنگ مو',
          active: true,
        },
      ],
      addons: [],
      presets: [],
    })
    generated.mutateSetupStaff.mockResolvedValue({ profile: { id: 'p1' } })

    await renderSalonDetail(`/salons/${salonId}?tab=setup`)

    fireEvent.change(await screen.findByLabelText('نام نمایشی'), {
      target: { value: 'سارا' },
    })
    const staffPanel = screen.getByText('پروفایل‌های پرسنل').closest('section')!
    fireEvent.change(within(staffPanel).getByLabelText('شماره موبایل'), {
      target: { value: '09121234567' },
    })
    fireEvent.click(screen.getByText('رنگ مو'))
    fireEvent.click(
      screen.getByRole('button', { name: 'ساخت پروفایل بدون حساب کاربری' }),
    )

    await waitFor(() => expect(generated.mutateSetupStaff).toHaveBeenCalled())
    expect(generated.mutateSetupStaff.mock.calls[0]?.[0]).toEqual({
      path: { id: salonId },
      body: expect.objectContaining({
        name: 'سارا',
        phone: '09121234567',
        serviceIds: ['66666666-6666-4666-8666-666666666666'],
        schedule: expect.arrayContaining([
          expect.objectContaining({ dayOfWeek: 0, active: true }),
        ]),
      }),
    })
    expect(screen.queryByLabelText(/رمز عبور/)).toBeNull()
  })

  it('adds one Client and confirms only selected eligible import rows', async () => {
    generated.getSalon.mockResolvedValue({
      salon: { id: salonId, name: 'Setup Aftab', status: 'setup' },
      members: [],
      stats: { services: 0, appointments: 0 },
    })
    generated.getNotes.mockResolvedValue({ notes: [] })
    generated.getSetup.mockResolvedValue({
      hours: {
        workingStart: '09:00',
        workingEnd: '19:00',
        slotDurationMinutes: 30,
        workingDays: 126,
      },
      presence: {
        address: null,
        mapGoogle: null,
        mapNeshan: null,
        mapBalad: null,
        socialInstagram: null,
        socialTelegram: null,
        socialWhatsapp: null,
        website: null,
      },
    })
    generated.createSetupClient.mockResolvedValue({ client: { id: 'c1' } })
    generated.previewSetupClientImport.mockResolvedValue({
      counts: {
        totalInFile: 3,
        eligible: 2,
        invalid: 1,
        duplicateExisting: 0,
        duplicateInFile: 0,
        truncated: false,
      },
      rows: [
        { localId: 'csv-1', name: 'Ali', phone: '09121111111', selected: true },
        {
          localId: 'csv-2',
          name: 'Sara',
          phone: '09122222222',
          selected: true,
        },
      ],
      skippedRows: [
        {
          localId: 'csv-3',
          name: 'Bad',
          phone: '123',
          reason: 'invalid',
          invalidDetail: 'invalid-phone',
        },
      ],
    })
    generated.importSetupClients.mockResolvedValue({
      imported: 1,
      skipped: 2,
      duplicate: 0,
      invalid: 1,
    })

    await renderSalonDetail(`/salons/${salonId}?tab=setup`)

    const addPanel = (
      await screen.findByRole('heading', { name: 'افزودن مشتری' })
    ).closest('section')!
    const add = within(addPanel as HTMLElement)
    fireEvent.change(add.getByLabelText('نام مشتری'), {
      target: { value: 'مریم' },
    })
    fireEvent.change(add.getByLabelText('شماره موبایل'), {
      target: { value: '۰۹۱۲۳۴۵۶۷۸۹' },
    })
    fireEvent.change(add.getByLabelText('دلیل افزودن'), {
      target: { value: 'Prepare client' },
    })
    fireEvent.click(add.getByRole('button', { name: 'افزودن مشتری' }))
    await waitFor(() => expect(generated.createSetupClient).toHaveBeenCalled())

    const importPanel = screen
      .getByText('ورود مشتریان از فایل')
      .closest('section')!
    const importUi = within(importPanel as HTMLElement)
    const source = 'name,phone\nAli,09121111111\nSara,09122222222\nBad,123'
    fireEvent.change(importUi.getByLabelText('فایل CSV یا VCF'), {
      target: {
        files: [{ name: 'clients.csv', text: () => Promise.resolve(source) }],
      },
    })
    await waitFor(() =>
      expect(generated.previewSetupClientImport).toHaveBeenCalled(),
    )
    fireEvent.click(await importUi.findByLabelText('انتخاب Sara'))
    fireEvent.change(importUi.getByLabelText('دلیل ورود'), {
      target: { value: 'Import selected clients' },
    })
    fireEvent.click(
      importUi.getByRole('button', { name: /تأیید و ورود 1 مشتری/ }),
    )

    await waitFor(() => expect(generated.importSetupClients).toHaveBeenCalled())
    expect(generated.importSetupClients.mock.calls[0]?.[0]).toEqual({
      path: { id: salonId },
      body: {
        format: 'csv',
        source,
        selectedLocalIds: ['csv-1'],
        reason: 'Import selected clients',
        liveConfirmation: undefined,
      },
    })
  })

  it('hides Setup Salon editing from platform support', async () => {
    mockAuthMe({ role: 'platform_support' })
    generated.getSalon.mockResolvedValue({
      salon: { id: salonId, name: 'Setup Aftab', status: 'setup' },
      members: [],
      stats: {},
    })
    generated.getNotes.mockResolvedValue({ notes: [] })

    renderAdminRoute(`/salons/${salonId}`)

    expect((await screen.findAllByText('Setup Aftab')).length).toBeGreaterThan(
      0,
    )
    expect(screen.queryByRole('tab', { name: 'آماده‌سازی' })).toBeNull()
    expect(generated.getSetup).not.toHaveBeenCalled()
  })

  it('requires a Platform Owner to deliberately enter a visually explicit active-salon override', async () => {
    generated.getSalon.mockResolvedValue({
      salon: { id: salonId, name: 'Active Aftab', status: 'active' },
      members: [],
      stats: {},
    })
    generated.getNotes.mockResolvedValue({ notes: [] })
    generated.getSetup.mockResolvedValue({
      hours: {
        workingStart: '09:00',
        workingEnd: '19:00',
        slotDurationMinutes: 30,
        workingDays: 126,
      },
      presence: {
        address: null,
        mapGoogle: null,
        mapNeshan: null,
        mapBalad: null,
        socialInstagram: null,
        socialTelegram: null,
        socialWhatsapp: null,
        website: null,
      },
    })

    await renderSalonDetail(`/salons/${salonId}?tab=setup`, {
      dataSource: 'live',
    })

    expect(
      await screen.findByRole('heading', {
        name: 'ورود به Platform Owner Override',
      }),
    ).toBeTruthy()
    expect(generated.getSetup).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', { name: /ورود آگاهانه به Override/ }),
    )

    expect(await screen.findByText('Override فعال است')).toBeTruthy()
    await waitFor(() => {
      expect(generated.getSetup).toHaveBeenCalledWith({
        path: { id: salonId },
        query: { override: true },
      })
    })
    expect(screen.queryByText('تحویل به مالک')).toBeNull()
  })

  it('does not expose active-salon override to a platform admin', async () => {
    mockAuthMe({ role: 'platform_admin' })
    generated.getSalon.mockResolvedValue({
      salon: { id: salonId, name: 'Active Aftab', status: 'active' },
      members: [],
      stats: {},
    })
    generated.getNotes.mockResolvedValue({ notes: [] })

    renderAdminRoute(`/salons/${salonId}`)

    expect((await screen.findAllByText('Active Aftab')).length).toBeGreaterThan(
      0,
    )
    expect(
      screen.queryByRole('tab', { name: 'Override مالک پلتفرم' }),
    ).toBeNull()
    expect(generated.getSetup).not.toHaveBeenCalled()
  })

  it('renders salon overview detail and submits a live-data status change with reason and confirmation', async () => {
    generated.getSalon.mockResolvedValue({
      salon: {
        id: salonId,
        name: 'Sun Salon',
        slug: 'aftab',
        status: 'active',
        phone: '+989121234567',
        timezone: 'Asia/Tehran',
        publicEnabled: true,
      },
      members: [
        { name: 'Maryam', role: 'owner', phoneNumber: '+989120000000' },
      ],
      stats: { services: 9, appointments: 12 },
    })
    generated.getNotes.mockResolvedValue({ notes: [] })
    generated.patchStatus.mockResolvedValue({ salon: { id: salonId } })

    await renderSalonDetail(`/salons/${salonId}?tab=governance`, {
      dataSource: 'live',
    })

    expect(
      await screen.findByRole('button', { name: /^تغییر وضعیت$/ }),
    ).toBeTruthy()
    expect(
      screen.getByRole('tab', { name: 'حاکمیت' }).getAttribute('aria-selected'),
    ).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /^تغییر وضعیت$/ }))
    expect(
      screen.getByText(
        /تغییر وضعیت سالن روی داده‌های زنده تولیدی اعمال می‌شود/,
      ),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('combobox', { name: 'وضعیت' }))
    fireEvent.click(await screen.findByRole('option', { name: 'تعلیق‌شده' }))
    fireEvent.change(screen.getByLabelText('دلیل'), {
      target: { value: 'Policy review' },
    })
    fireEvent.change(screen.getByLabelText('تأیید داده LIVE'), {
      target: { value: 'LIVE' },
    })
    fireEvent.click(screen.getByRole('button', { name: /به‌روزرسانی وضعیت/ }))

    await waitFor(() => {
      expect(generated.patchStatus).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'تغییر وضعیت سالن' }),
      ).toBeNull()
    })
    expect(generated.patchStatus.mock.calls[0]?.[0]).toEqual({
      path: { id: salonId },
      body: {
        status: 'suspended',
        reason: 'Policy review',
        liveConfirmation: 'LIVE',
      },
    })
  })

  it('lists and creates internal salon notes with a required reason', async () => {
    generated.getSalon.mockResolvedValue({
      salon: { id: salonId, name: 'Sun Salon', status: 'active' },
      members: [],
      stats: { services: 0, appointments: 0 },
    })
    generated.getNotes.mockResolvedValue({
      notes: [
        {
          id: 'note-1',
          subjectType: 'salon',
          subjectId: salonId,
          body: 'Needs follow-up',
          authorUserId: 'admin-user-id',
          authorName: 'Admin',
          createdAt: '2026-06-18T10:30:00.000Z',
        },
      ],
    })
    generated.postNote.mockResolvedValue({ note: { id: 'note-2' } })

    renderSalonDetail(`/salons/${salonId}?tab=governance`)

    expect(await screen.findByText('Needs follow-up')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('یادداشت'), {
      target: { value: 'Call owner again' },
    })
    fireEvent.change(
      screen.getByPlaceholderText('ثبت دلیل برای گزارش ممیزی الزامی است'),
      {
        target: { value: 'Internal follow-up note' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: /افزودن یادداشت/ }))

    await waitFor(() => {
      expect(generated.postNote).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(
        (screen.getByLabelText('یادداشت') as HTMLTextAreaElement).value,
      ).toBe('')
    })
    expect(generated.postNote.mock.calls[0]?.[0]).toEqual({
      path: { id: salonId },
      body: {
        body: 'Call owner again',
        reason: 'Internal follow-up note',
      },
    })
  })

  it('renders read-only salon tenant data tabs with populated and empty states', async () => {
    generated.getSalon.mockResolvedValue({
      salon: { id: salonId, name: 'Sun Salon', status: 'active' },
      members: [],
      stats: { services: 1, appointments: 0, appointmentRequests: 0 },
    })
    generated.getNotes.mockResolvedValue({ notes: [] })
    generated.getClients.mockResolvedValue({
      items: [
        {
          id: 'client-1',
          name: 'Client One',
          phone: '+989121111111',
          isPlaceholder: false,
          notes: 'VIP',
          createdAt: '2026-06-18T10:30:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1 },
    })
    generated.getServices.mockResolvedValue({
      items: [
        {
          id: 'service-1',
          name: 'ServiceVariant Cut',
          kind: 'standard',
          categoryName: 'Hair',
          familyName: 'Cut',
          duration: 45,
          price: 500000,
          active: true,
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1 },
    })

    await renderSalonDetail(`/salons/${salonId}?tab=operations`)

    expect(await screen.findByText('Client One')).toBeTruthy()
    expect(screen.queryByText(/Add Client/)).toBeNull()
    expect(generated.getClients).toHaveBeenCalledWith({
      path: { id: salonId },
      query: { page: 1, pageSize: 10, search: undefined },
    })

    fireEvent.click(screen.getByRole('tab', { name: 'نوبت‌ها' }))
    await waitFor(() => {
      expect(generated.getAppointments).toHaveBeenCalled()
    })
    expect(generated.getAppointments.mock.calls[0]?.[0]).toEqual({
      path: { id: salonId },
      query: { page: 1, pageSize: 10, search: undefined },
    })
    expect(screen.queryByText(/Add Appointment/)).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'انواع خدمت' }))
    await waitFor(() => {
      expect(generated.getServices).toHaveBeenCalled()
    })
    expect(screen.queryByText(/Add ServiceVariant/)).toBeNull()
  })
})
