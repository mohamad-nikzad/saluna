// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useForm } from 'react-hook-form'
import type { AppointmentFormInput } from '@repo/salon-core/forms/appointment'
import { AppointmentDetailEditForm } from './appointment-detail-edit-form'

vi.mock('#/components/calendar/appointment-client-field', () => ({
  AppointmentClientField: () => null,
}))
vi.mock('#/components/calendar/staff-picker', () => ({
  StaffPicker: () => null,
}))
vi.mock('#/components/services/service-picker', () => ({
  ServicePicker: () => null,
}))
vi.mock('@repo/ui/jalali-date-picker', () => ({ JalaliDatePicker: () => null }))
vi.mock('@repo/ui/time-picker', () => ({ TimePicker: () => null }))

afterEach(cleanup)

function PriceForm({ priceEditable }: { priceEditable: boolean }) {
  const editForm = useForm<AppointmentFormInput>({
    defaultValues: { finalPrice: 125_000 },
  })
  return (
    <AppointmentDetailEditForm
      editForm={editForm}
      onSubmit={() => {}}
      localClients={[]}
      onClientCreated={() => {}}
      useTemporaryClient={false}
      temporaryClientName=""
      temporaryClientNotes=""
      temporaryClientNameRef={{ current: null }}
      clientId=""
      staffId=""
      serviceId=""
      date="2026-06-01"
      startTime="09:00"
      durationInput={60}
      durationMinutes={60}
      endTime="10:00"
      addonIds={[]}
      finalPrice={125_000}
      priceEditable={priceEditable}
      staffRoleOnly={[]}
      editableServices={[]}
      selectedEditService={undefined}
      addonOptions={[]}
      availableAddons={[]}
      addonsLoading={false}
      previewDuration={60}
      previewPrice={125_000}
      status="scheduled"
      onStatusChange={() => {}}
      onTemporaryClientModeChange={() => {}}
      onEditStaffChange={() => {}}
      onClearEditStaff={() => {}}
      onEditServiceChange={() => {}}
      onClearEditService={() => {}}
      onToggleAddon={() => {}}
      applyDurationInput={() => {}}
      triggerEdit={editForm.trigger}
      applyEndTime={() => {}}
    />
  )
}

describe('AppointmentDetailEditForm price window', () => {
  it('switches the price control from editable to explained read-only state', () => {
    const view = render(<PriceForm priceEditable />)
    expect(
      (screen.getByLabelText('قیمت نهایی (تومان)') as HTMLInputElement)
        .disabled,
    ).toBe(false)

    view.rerender(<PriceForm priceEditable={false} />)
    expect(
      (screen.getByLabelText('قیمت نهایی (تومان)') as HTMLInputElement)
        .disabled,
    ).toBe(true)
    expect(
      screen.getByText('مهلت ۲۴ ساعته ویرایش مبلغ به پایان رسیده است.'),
    ).toBeTruthy()
  })
})
