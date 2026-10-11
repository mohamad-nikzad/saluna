// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from '@repo/salon-core/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  cancelInvite: vi.fn(),
  resendInvite: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => mocks.navigate,
}))

vi.mock('#/lib/staff-queries', () => ({
  useCancelStaffInviteMutation: () => ({ mutate: mocks.cancelInvite }),
  useResendStaffInviteMutation: () => ({ mutate: mocks.resendInvite }),
}))

import { StaffListCard } from './staff-list-card'

const member: User = {
  id: 'staff-a',
  salonId: 'salon-a',
  name: 'سارا احمدی',
  role: 'staff',
  color: 'rose',
  phone: '09120000000',
  createdAt: new Date('2026-10-11'),
  inviteStatus: 'pending',
}

function renderCard(staff = member) {
  const actions = {
    onEditServices: vi.fn(),
    onEditSchedule: vi.fn(),
    onDelete: vi.fn(),
  }
  render(
    <div dir="rtl">
      <StaffListCard
        member={staff}
        currentUserId="manager-a"
        serviceCount={3}
        {...actions}
      />
    </div>,
  )
  return actions
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('StaffListCard navigation', () => {
  it('opens each staff profile from its labeled arrow control', () => {
    renderCard()
    const otherMember = { ...member, id: 'staff-b', name: 'مریم رضایی' }
    renderCard(otherMember)

    for (const staff of [member, otherMember]) {
      const arrow = screen.getByRole('button', {
        name: `مشاهده پروفایل ${staff.name}`,
      })
      arrow.focus()
      expect(document.activeElement).toBe(arrow)
      const icon = arrow.querySelector('svg')
      if (!icon) throw new Error('Missing profile arrow')
      fireEvent.click(icon)
      expect(mocks.navigate).toHaveBeenLastCalledWith({
        to: '/staff/$id',
        params: { id: staff.id },
      })
      fireEvent.click(arrow)
      expect(mocks.navigate).toHaveBeenLastCalledWith({
        to: '/staff/$id',
        params: { id: staff.id },
      })
    }
    expect(mocks.navigate).toHaveBeenCalledTimes(4)
  })

  it('still opens the profile from the name and avatar', () => {
    renderCard()
    fireEvent.click(screen.getByText(member.name))
    fireEvent.click(screen.getByText('سا'))
    expect(mocks.navigate).toHaveBeenCalledTimes(2)
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: '/staff/$id',
      params: { id: member.id },
    })
  })

  it.each([
    ['خدمات قابل ارائه', 'onEditServices'],
    ['روزها و ساعات کاری', 'onEditSchedule'],
    ['حذف پرسنل', 'onDelete'],
    ['ارسال دوباره دعوت', 'resendInvite'],
    ['لغو دعوت', 'cancelInvite'],
  ] as const)(
    'keeps the %s menu action independent of navigation',
    async (label, action) => {
      const actions = renderCard()
      const trigger = screen.getByRole('button', {
        name: `گزینه‌های بیشتر برای ${member.name}`,
      })
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })
      const menuItem = await screen.findByRole('menuitem', { name: label })
      expect(mocks.navigate).not.toHaveBeenCalled()
      fireEvent.click(menuItem)

      if (action === 'resendInvite' || action === 'cancelInvite') {
        expect(mocks[action]).toHaveBeenCalledWith(member.id)
      } else {
        expect(actions[action]).toHaveBeenCalledOnce()
      }
      expect(mocks.navigate).not.toHaveBeenCalled()
    },
  )
})
