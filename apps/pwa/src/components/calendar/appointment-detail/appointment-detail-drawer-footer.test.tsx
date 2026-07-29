// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Drawer } from '@repo/ui/drawer'

import { AppointmentDetailDrawerFooter } from './appointment-detail-drawer-footer'

const props = {
  readOnly: false,
  showDeleteConfirm: false,
  deletingCompletedAppointment: false,
  isMutating: false,
  isEditSubmitting: false,
  useTemporaryClient: false,
  temporaryClientName: '',
  clientId: 'client-1',
  onCancelEdit: vi.fn(),
  onConfirmDelete: vi.fn(),
  onCancelDelete: vi.fn(),
  onStartEditing: vi.fn(),
  onShowDeleteConfirm: vi.fn(),
}

it('does not reuse the edit button as the form submit button', () => {
  const view = render(
    <Drawer open>
      <AppointmentDetailDrawerFooter {...props} isEditing={false} />
    </Drawer>,
  )
  const editButton = screen.getByRole('button', { name: 'ویرایش نوبت' })

  view.rerender(
    <Drawer open>
      <AppointmentDetailDrawerFooter {...props} isEditing />
    </Drawer>,
  )
  expect(screen.getByRole('button', { name: 'ذخیره تغییرات' })).not.toBe(
    editButton,
  )
})

it('warns that deleting a completed Appointment permanently removes commission history', () => {
  render(
    <AppointmentDetailDrawerFooter
      {...props}
      isEditing={false}
      showDeleteConfirm
      deletingCompletedAppointment
    />,
  )
  expect(screen.getByText(/سابقه کمیسیون.*برای همیشه حذف می‌شود/)).toBeTruthy()
})
