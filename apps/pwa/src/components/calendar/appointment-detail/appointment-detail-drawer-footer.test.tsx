// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { AppointmentDetailDrawerFooter } from './appointment-detail-drawer-footer'

it('warns that deleting a completed Appointment permanently removes commission history', () => {
  render(
    <AppointmentDetailDrawerFooter
      readOnly={false}
      isEditing={false}
      showDeleteConfirm
      deletingCompletedAppointment
      isMutating={false}
      isEditSubmitting={false}
      useTemporaryClient={false}
      temporaryClientName=""
      clientId="client-1"
      onSave={vi.fn()}
      onCancelEdit={vi.fn()}
      onConfirmDelete={vi.fn()}
      onCancelDelete={vi.fn()}
      onStartEditing={vi.fn()}
      onShowDeleteConfirm={vi.fn()}
    />,
  )
  expect(screen.getByText(/سابقه کمیسیون.*برای همیشه حذف می‌شود/)).toBeTruthy()
})
