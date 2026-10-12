// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { useState } from 'react'
import type { Service, User } from '@repo/salon-core/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  patchServices: vi.fn(),
}))

vi.mock('@repo/api-client/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@repo/api-client/sdk')>()),
  patchApiV1StaffByIdServices: mocks.patchServices,
}))

import { StaffServicesDrawer } from './staff-services-drawer'

const member: User = {
  id: 'staff-a',
  salonId: 'salon-a',
  name: 'سارا احمدی',
  role: 'staff',
  phone: '09120000000',
  createdAt: new Date('2026-10-12'),
  serviceIds: ['hair-cut'],
}

const services: Service[] = [
  {
    id: 'hair-cut',
    name: 'کوتاهی مو',
    category: 'hair',
    categoryId: 'hair',
    categoryName: 'خدمات مو',
    duration: 30,
    price: 100,
    color: 'pink',
    active: true,
  },
  {
    id: 'keratin',
    name: 'کراتین مو',
    category: 'hair',
    categoryId: 'hair',
    categoryName: 'خدمات مو',
    duration: 90,
    price: 300,
    color: 'pink',
    active: true,
  },
  {
    id: 'nails',
    name: 'مانیکور',
    category: 'nails',
    categoryId: 'nails',
    categoryName: 'زیبایی ناخن',
    duration: 45,
    price: 200,
    color: 'pink',
    active: true,
  },
  {
    id: 'retired',
    name: 'خدمت غیرفعال',
    category: 'hair',
    categoryId: 'hair',
    categoryName: 'خدمات مو',
    duration: 30,
    price: 100,
    color: 'pink',
    active: false,
  },
]

const searchLabel = 'جستجوی نام خدمت یا دسته‌بندی'
const emptyError =
  'حداقل یک خدمت انتخاب کنید، یا حالت «همه خدمات» را فعال بگذارید.'

function search(value: string) {
  fireEvent.change(screen.getByRole('searchbox', { name: searchLabel }), {
    target: { value },
  })
}

function click(label: string) {
  fireEvent.click(
    screen.getByRole('button', {
      name: label,
      hidden: label === 'باز کردن خدمات',
    }),
  )
}

async function expectClosed() {
  // Without stylesheets, jsdom keeps Vaul's exiting dialog accessible.
  await waitFor(() =>
    expect(screen.getByRole('dialog').getAttribute('data-state')).toBe(
      'closed',
    ),
  )
}

function checkbox(name: string) {
  return screen.getByRole('checkbox', { name })
}

function renderDrawer(staff = member, catalog = services) {
  let saved = staff
  mocks.patchServices.mockImplementation(
    async ({
      body,
      path,
    }: {
      body: { serviceIds: string[] | null }
      path: { id: string }
    }) => {
      saved = { ...saved, id: path.id, serviceIds: body.serviceIds }
      return { data: { staff: saved } }
    },
  )
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Editor({ catalog }: { catalog: Service[] }) {
    const [open, setOpen] = useState(true)
    const [currentStaff, setStaff] = useState(staff)
    return (
      <QueryClientProvider client={queryClient}>
        <div dir="rtl">
          <button
            onClick={() => {
              setStaff(saved)
              setOpen(true)
            }}
          >
            باز کردن خدمات
          </button>
          <StaffServicesDrawer
            open={open}
            onOpenChange={setOpen}
            staff={currentStaff}
            services={catalog}
            onSuccess={() => setOpen(false)}
          />
        </div>
      </QueryClientProvider>
    )
  }
  const view = render(<Editor catalog={catalog} />)
  return {
    saved: () => saved,
    updateCatalog: (next: Service[]) =>
      view.rerender(<Editor catalog={next} />),
  }
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('StaffServicesDrawer', () => {
  it('toggles whole categories, reflects partial selection, and saves only explicit active service IDs', async () => {
    const { saved } = renderDrawer({
      ...member,
      serviceIds: ['hair-cut', 'nails', 'retired', 'missing'],
    })
    const hairGroup = () => checkbox('همه خدمات دسته خدمات مو')
    expect(hairGroup().getAttribute('aria-checked')).toBe('mixed')
    fireEvent.click(hairGroup())
    expect(hairGroup().getAttribute('aria-checked')).toBe('true')
    expect(checkbox('کراتین مو').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('مانیکور').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(checkbox('کوتاهی مو'))
    expect(hairGroup().getAttribute('aria-checked')).toBe('mixed')
    fireEvent.click(hairGroup())
    fireEvent.click(hairGroup())
    expect(hairGroup().getAttribute('aria-checked')).toBe('false')
    expect(checkbox('کراتین مو').getAttribute('aria-checked')).toBe('false')
    expect(checkbox('کوتاهی مو').getAttribute('aria-checked')).toBe('false')
    click('ذخیره')
    await waitFor(() =>
      expect(saved().serviceIds).toEqual(['nails', 'retired', 'missing']),
    )
  })

  it('scopes a searched category toggle to matching services without changing its hidden selections', () => {
    renderDrawer({ ...member, serviceIds: ['hair-cut', 'nails'] })
    search('کراتین')
    const group = checkbox('خدمات نتایج جستجوی دسته خدمات مو')
    expect(group.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(group)
    expect(group.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('status').textContent).toBe('۳ خدمت انتخاب شده')
    fireEvent.click(group)
    click('پاک کردن جستجو')
    expect(
      checkbox('همه خدمات دسته خدمات مو').getAttribute('aria-checked'),
    ).toBe('mixed')
    expect(checkbox('کوتاهی مو').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('مانیکور').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('کراتین مو').getAttribute('aria-checked')).toBe('false')
    click('انصراف')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('searches Persian service and category names while preserving category groups', () => {
    renderDrawer()
    search('  كراتين  ')
    expect(checkbox('کراتین مو')).toBeTruthy()
    expect(screen.getByText('خدمات مو')).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: 'کوتاهی مو' })).toBeNull()
    expect(screen.queryByText('زیبایی ناخن')).toBeNull()

    search('  زيبايي  ')
    expect(checkbox('مانیکور')).toBeTruthy()
    expect(screen.getByText('زیبایی ناخن')).toBeTruthy()
    expect(screen.queryByText('خدمات مو')).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'خدمت غیرفعال' })).toBeNull()
  })

  it('scopes bulk changes to results and preserves hidden and unavailable selections on save', async () => {
    const { saved } = renderDrawer({
      ...member,
      serviceIds: ['hair-cut', 'nails', 'retired', 'missing'],
    })
    search('کراتین')
    click('انتخاب همه نتایج جستجو')
    expect(checkbox('کراتین مو').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('status').textContent).toBe('۵ خدمت انتخاب شده')
    click('لغو انتخاب نتایج جستجو')
    expect(checkbox('کراتین مو').getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('status').textContent).toBe('۴ خدمت انتخاب شده')
    click('پاک کردن جستجو')
    expect(checkbox('کوتاهی مو').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('مانیکور').getAttribute('aria-checked')).toBe('true')

    click('لغو انتخاب همه خدمات فعال')
    expect(screen.getByRole('status').textContent).toBe('۲ خدمت انتخاب شده')
    click('ذخیره')
    await waitFor(() =>
      expect(saved().serviceIds).toEqual(['retired', 'missing']),
    )
    expect(mocks.patchServices).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: member.id },
        body: { serviceIds: ['retired', 'missing'] },
      }),
    )
  })

  it('disables bulk actions for no results and clears search without dirtying the draft', () => {
    renderDrawer()
    search('نام ناموجود')
    expect(screen.getByText('خدمتی با این جستجو پیدا نشد.')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'انتخاب همه نتایج جستجو' }),
    ).toHaveProperty('disabled', true)
    expect(
      screen.getByRole('button', { name: 'لغو انتخاب نتایج جستجو' }),
    ).toHaveProperty('disabled', true)
    click('پاک کردن جستجو')
    expect(document.activeElement).toBe(
      screen.getByRole('searchbox', { name: searchLabel }),
    )
    expect(checkbox('کوتاهی مو').getAttribute('aria-checked')).toBe('true')
    click('انصراف')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mocks.patchServices).not.toHaveBeenCalled()
  })

  it('saves explicit select-all and restores it on reopen, while unrestricted mode saves null', async () => {
    const { saved, updateCatalog } = renderDrawer()
    search('   ')
    click('انتخاب همه خدمات فعال')
    expect(
      screen
        .getByRole('switch', { name: 'همه خدمات فعال' })
        .getAttribute('aria-checked'),
    ).toBe('false')
    click('ذخیره')
    await waitFor(() =>
      expect(saved().serviceIds).toEqual(['hair-cut', 'keratin', 'nails']),
    )
    await expectClosed()
    click('باز کردن خدمات')
    expect(screen.getByRole('searchbox', { name: searchLabel })).toHaveProperty(
      'value',
      '',
    )
    for (const service of services.filter((item) => item.active)) {
      expect(checkbox(service.name).getAttribute('aria-checked')).toBe('true')
    }
    updateCatalog([
      ...services,
      { ...services[0], id: 'new-service', name: 'خدمت جدید' },
    ])
    expect(checkbox('خدمت جدید').getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByRole('switch', { name: 'همه خدمات فعال' }))
    click('ذخیره')
    await waitFor(() => expect(saved().serviceIds).toBeNull())
    await expectClosed()
    click('باز کردن خدمات')
    expect(
      screen
        .getByRole('switch', { name: 'همه خدمات فعال' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('rejects an empty custom draft before normalization and lets the manager rebuild it', async () => {
    renderDrawer()
    click('لغو انتخاب همه خدمات فعال')
    expect(screen.getByRole('status').textContent).toBe('۰ خدمت انتخاب شده')
    click('ذخیره')
    expect(screen.getByText(emptyError)).toBeTruthy()
    expect(mocks.patchServices).not.toHaveBeenCalled()
    expect(
      screen
        .getByRole('switch', { name: 'همه خدمات فعال' })
        .getAttribute('aria-checked'),
    ).toBe('false')
    fireEvent.click(checkbox('مانیکور'))
    expect(screen.queryByText(emptyError)).toBeNull()
    click('ذخیره')
    await waitFor(() =>
      expect(mocks.patchServices).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { serviceIds: ['nails'] },
        }),
      ),
    )
  })

  it.each(['bulk', 'individual'])(
    'guards unsaved %s edits and restores saved values after discard',
    async (kind) => {
      const { saved } = renderDrawer()
      if (kind === 'bulk') click('انتخاب همه خدمات فعال')
      else fireEvent.click(checkbox('مانیکور'))
      click('انصراف')
      expect(
        screen.getByRole('alertdialog', { name: 'خروج بدون ذخیره؟' }),
      ).toBeTruthy()
      click('ادامه ویرایش')
      expect(checkbox('مانیکور').getAttribute('aria-checked')).toBe('true')
      click('انصراف')
      click('بستن بدون ذخیره')
      await expectClosed()
      expect(mocks.patchServices).not.toHaveBeenCalled()
      expect(saved().serviceIds).toEqual(['hair-cut'])
      click('باز کردن خدمات')
      expect(checkbox('کوتاهی مو').getAttribute('aria-checked')).toBe('true')
      expect(checkbox('مانیکور').getAttribute('aria-checked')).toBe('false')
    },
  )

  it('resets the query and draft when the open editor receives another Staff Profile', async () => {
    const queryClient = new QueryClient()
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      services,
      onSuccess: vi.fn(),
    }
    const view = render(
      <QueryClientProvider client={queryClient}>
        <StaffServicesDrawer {...props} staff={member} />
      </QueryClientProvider>,
    )
    search('کراتین')
    click('انتخاب همه نتایج جستجو')
    const other = {
      ...member,
      id: 'staff-b',
      name: 'مریم',
      serviceIds: ['nails'],
    }
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <StaffServicesDrawer {...props} staff={other} />
      </QueryClientProvider>,
    )
    expect(screen.getByRole('searchbox', { name: searchLabel })).toHaveProperty(
      'value',
      '',
    )
    expect(checkbox('کراتین مو').getAttribute('aria-checked')).toBe('false')
    expect(checkbox('مانیکور').getAttribute('aria-checked')).toBe('true')
    expect(member.serviceIds).toEqual(['hair-cut'])
    expect(mocks.patchServices).not.toHaveBeenCalled()
    mocks.patchServices.mockResolvedValue({ data: { staff: other } })
    click('ذخیره')
    await waitFor(() =>
      expect(mocks.patchServices).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { id: 'staff-b' },
          body: { serviceIds: ['nails'] },
        }),
      ),
    )
  })

  it('keeps a failed save open with the draft available for retry', async () => {
    renderDrawer()
    mocks.patchServices.mockRejectedValue(new Error('offline'))
    fireEvent.click(checkbox('مانیکور'))
    click('ذخیره')
    await waitFor(() => expect(mocks.patchServices).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'ذخیره' })).toHaveProperty(
        'disabled',
        false,
      ),
    )
    expect(checkbox('مانیکور').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('dialog', { name: 'خدمات مجاز' })).toBeTruthy()
  })
})
