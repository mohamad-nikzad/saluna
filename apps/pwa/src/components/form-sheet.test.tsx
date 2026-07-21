// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDismissGuard } from '#/lib/use-dismiss-guard'

import {
  FormSheet,
  FormSheetContent,
  FormSheetDescription,
  FormSheetHeader,
  FormSheetTitle,
} from './form-sheet'

afterEach(cleanup)

function GuardedFormSheet({
  dirty,
  onClose,
}: {
  dirty: boolean
  onClose: () => void
}) {
  const [open, setOpen] = useState(true)
  const { requestClose, confirmDialog } = useDismissGuard({
    isDirty: dirty,
    onClose: () => {
      setOpen(false)
      onClose()
    },
  })

  return (
    <FormSheet open={open} onOpenChange={requestClose}>
      <FormSheetContent onRequestClose={() => requestClose(false)}>
        <FormSheetHeader>
          <FormSheetTitle>ویرایش مشتری</FormSheetTitle>
          <FormSheetDescription>مشخصات مشتری</FormSheetDescription>
        </FormSheetHeader>
      </FormSheetContent>
      {confirmDialog}
    </FormSheet>
  )
}

describe('FormSheet', () => {
  it('exposes an accessible dialog and keeps dismissal on the explicit close control', async () => {
    const onOpenChange = vi.fn()
    const onRequestClose = vi.fn()

    render(
      <FormSheet open onOpenChange={onOpenChange}>
        <FormSheetContent onRequestClose={onRequestClose}>
          <FormSheetHeader>
            <FormSheetTitle>ثبت نوبت</FormSheetTitle>
            <FormSheetDescription>
              مشخصات نوبت را وارد کنید.
            </FormSheetDescription>
          </FormSheetHeader>
        </FormSheetContent>
      </FormSheet>,
    )

    const dialog = screen.getByRole('dialog', { name: 'ثبت نوبت' })
    const descriptionId = dialog.getAttribute('aria-describedby')
    expect(descriptionId).toBeTruthy()
    expect(document.getElementById(descriptionId!)?.textContent).toBe(
      'مشخصات نوبت را وارد کنید.',
    )
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'بستن' }),
      ),
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(onRequestClose).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'بستن' }))

    expect(onRequestClose).toHaveBeenCalledTimes(2)
  })

  it('prompts before discarding a dirty form', () => {
    const onClose = vi.fn()
    render(<GuardedFormSheet dirty onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'بستن' }))

    expect(
      screen.getByRole('alertdialog', { name: 'خروج بدون ذخیره؟' }),
    ).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'ادامه ویرایش' }))
    expect(screen.getByRole('dialog', { name: 'ویرایش مشتری' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'بستن' }))
    fireEvent.click(screen.getByRole('button', { name: 'بستن بدون ذخیره' }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog', { name: 'ویرایش مشتری' })).toBeNull()
  })

  it('closes a pristine form without prompting', () => {
    const onClose = vi.fn()
    render(<GuardedFormSheet dirty={false} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'بستن' }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
