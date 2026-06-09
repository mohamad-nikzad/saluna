import { useCallback, useState } from 'react'
import { toast } from '@repo/ui/use-toast'
import { resolveSingleDeviceContact } from '@repo/salon-core/device-contacts'

import { pickDeviceContacts } from '#/lib/device-contacts'

const INVALID_PHONE_TOAST = {
  variant: 'destructive' as const,
  title: 'شماره معتبر یافت نشد',
}

export type DeviceContactPhoneSheetState = {
  open: boolean
  name: string
  phones: string[]
}

export function useSingleDeviceContactPick({
  isActive,
  onReady,
  onChoosePhone,
  onInvalid,
}: {
  isActive: () => boolean
  onReady: (name: string, phone: string) => void
  onChoosePhone: (name: string, phones: string[]) => void
  onInvalid?: () => void
}) {
  const [phoneSheet, setPhoneSheet] = useState<DeviceContactPhoneSheetState>({
    open: false,
    name: '',
    phones: [],
  })

  const resetPhoneSheet = useCallback(() => {
    setPhoneSheet({ open: false, name: '', phones: [] })
  }, [])

  const handleInvalid = useCallback(() => {
    toast(INVALID_PHONE_TOAST)
    onInvalid?.()
  }, [onInvalid])

  const pickFromDevice = useCallback(async () => {
    const rows = await pickDeviceContacts({ multiple: false })
    if (!isActive()) return
    if (!rows || rows.length === 0) return

    const resolved = resolveSingleDeviceContact(rows[0]!)

    if (resolved.kind === 'invalid') {
      handleInvalid()
      return
    }

    if (resolved.kind === 'choose-phone') {
      setPhoneSheet({
        open: true,
        name: resolved.name,
        phones: resolved.phones,
      })
      onChoosePhone(resolved.name, resolved.phones)
      return
    }

    onReady(resolved.name, resolved.phone)
  }, [handleInvalid, isActive, onChoosePhone, onReady])

  const handlePhoneSelected = useCallback(
    (phone: string) => {
      const name = phoneSheet.name
      resetPhoneSheet()
      if (!isActive()) return
      onReady(name, phone)
    },
    [isActive, onReady, phoneSheet.name, resetPhoneSheet],
  )

  const phoneSheetProps = {
    open: phoneSheet.open,
    name: phoneSheet.name,
    phones: phoneSheet.phones,
    onSelect: handlePhoneSelected,
    onOpenChange: (nextOpen: boolean) => {
      setPhoneSheet((prev) =>
        nextOpen
          ? { ...prev, open: true }
          : { open: false, name: '', phones: [] },
      )
    },
  }

  return {
    pickFromDevice,
    phoneSheetProps,
    handlePhoneSelected,
    resetPhoneSheet,
  }
}
