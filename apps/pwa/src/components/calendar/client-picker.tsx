import { useState, useRef, useEffect, useMemo } from 'react'
import { useCreateClientMutation } from '#/lib/clients-queries'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Contact,
  Plus,
  Search,
  UserPlus,
  X,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@repo/ui/input'
import { Button } from '@repo/ui/button'
import { Spinner } from '@repo/ui/spinner'
import {
  DrawerContent,
  DrawerHeader,
  DrawerNested,
  DrawerTitle,
  DrawerTrigger,
} from '@repo/ui/drawer'
import { useIsTouch } from '@repo/ui/use-mobile'
import { cn } from '@repo/ui/utils'
import type { Client } from '@repo/salon-core/types'
import { displayPhone, normalizePhone } from '@repo/salon-core/phone'
import { clientFormSchema } from '@repo/salon-core/forms/client'
import type { ClientFormInput } from '@repo/salon-core/forms/client'
import { useKeyboardInset } from '#/lib/use-keyboard-inset'
import { findClientByCanonicalPhone } from '@repo/salon-core/device-contacts'
import { isDeviceContactPickerSupported } from '#/lib/device-contacts'
import { DeviceContactPickButton } from '#/components/clients/device-contact-pick-button'
import { DeviceContactPhoneSheet } from '#/components/clients/device-contact-phone-sheet'
import { useSingleDeviceContactPick } from '#/lib/use-single-device-contact-pick'

interface ClientPickerProps {
  clients: Client[]
  value: string
  onChange: (clientId: string) => void
  onClientCreated: (client: Client) => void
  /** When false, in-flight device picks are discarded (e.g. parent drawer closed). */
  hostActive?: boolean
  /** Show device contact action beside the trigger instead of inside the list. */
  contactActionPlacement?: 'list' | 'beside'
  ariaLabel?: string
}

type PickerMode = 'closed' | 'searching' | 'adding'

export function ClientPicker({
  clients,
  value,
  onChange,
  onClientCreated,
  hostActive = true,
  contactActionPlacement = 'list',
  ariaLabel,
}: ClientPickerProps) {
  const isTouch = useIsTouch()
  const [mode, setMode] = useState<PickerMode>('closed')
  const [query, setQuery] = useState('')
  const {
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: { name: '', phone: '', notes: '', tags: [] },
  })
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef<PickerMode>(mode)
  const newName = watch('name')
  const newPhone = watch('phone')

  useKeyboardInset(isTouch && mode !== 'closed')

  const selectedClient = clients.find((c) => c.id === value)

  const filtered = useMemo(() => {
    if (!query.trim()) return clients
    const q = query.trim().toLowerCase()
    const phoneQuery = normalizePhone(q)
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (phoneQuery.length > 0 && (c.phone ?? '').includes(phoneQuery)),
    )
  }, [clients, query])

  const hasExactMatch = useMemo(() => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    const phoneQuery = normalizePhone(q)
    return clients.some(
      (c) =>
        c.name.toLowerCase() === q ||
        (phoneQuery.length > 0 && c.phone === phoneQuery),
    )
  }, [clients, query])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    if (mode === 'searching' && !isTouch) {
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [mode, isTouch])

  const openSearch = () => {
    setQuery('')
    reset({ name: '', phone: '', notes: '', tags: [] })
    setMode('searching')
  }

  const continueWithDeviceContactRef = useRef<
    (name: string, phone: string) => void
  >(() => {})

  const { pickFromDevice, phoneSheetProps, resetPhoneSheet } =
    useSingleDeviceContactPick({
      isActive: () =>
        hostActive &&
        (contactActionPlacement === 'beside' || modeRef.current !== 'closed'),
      onReady: (name, phone) =>
        continueWithDeviceContactRef.current(name, phone),
      onChoosePhone: () => {},
    })

  const selectClient = (id: string) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    resetPhoneSheet()
    onChange(id)
    setMode('closed')
    setQuery('')
  }

  const continueWithDeviceContact = (name: string, phone: string) => {
    const existing = findClientByCanonicalPhone(clients, phone)
    if (existing) {
      selectClient(existing.id)
      return
    }

    reset({
      name,
      phone,
      notes: '',
      tags: [],
    })
    setMode('adding')
  }

  useEffect(() => {
    continueWithDeviceContactRef.current = continueWithDeviceContact
  })

  useEffect(() => {
    if (hostActive) return
    setMode('closed')
    setQuery('')
    resetPhoneSheet()
  }, [hostActive, resetPhoneSheet])

  useEffect(() => {
    if (isTouch || mode === 'closed') return
    function handleClick(e: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
        setMode('closed')
        setQuery('')
        resetPhoneSheet()
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [mode, isTouch, resetPhoneSheet])

  const startAdding = () => {
    const q = query.trim()
    const looksLikePhone = /^[\d۰-۹٠-٩\s+()-]{4,}$/.test(q)
    reset({
      name: looksLikePhone ? '' : q,
      phone: looksLikePhone ? normalizePhone(q) : '',
      notes: '',
      tags: [],
    })
    setMode('adding')
  }

  const cancelAdding = () => {
    setMode('searching')
    reset({ name: '', phone: '', notes: '', tags: [] })
  }

  const createClient = useCreateClientMutation()

  const handleSaveNew = handleSubmit(async (values) => {
    try {
      const created = await createClient.mutateAsync(values)

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      onClientCreated(created)
      onChange(created.id)
      setMode('closed')
      setQuery('')
      reset({ name: '', phone: '', notes: '', tags: [] })
    } catch {
      // Toast handled by mutation cache.
    }
  })

  const triggerButton = (
    <button
      type="button"
      aria-label={ariaLabel}
      dir="rtl"
      onClick={isTouch ? undefined : openSearch}
      className={cn(
        'flex h-9 touch:h-11 w-full items-center gap-2 rounded-md border border-input bg-blush-soft dark:bg-input/30 px-3 text-base md:text-sm transition-colors touch-manipulation',
        'hover:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
        !selectedClient && 'text-muted-foreground',
      )}
    >
      <span className="flex-1 truncate text-start">
        {selectedClient
          ? `${selectedClient.name}${selectedClient.isPlaceholder ? ' · اطلاعات ناقص' : ` · ${displayPhone(selectedClient.phone)}`}`
          : 'انتخاب مشتری…'}
      </span>
      {isTouch ? (
        <ChevronLeft className="h-4 w-4 shrink-0 opacity-50" />
      ) : (
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      )}
    </button>
  )

  const searchingBody = (
    <>
      <div className="flex items-center gap-2 border-b border-border/60 px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجو نام یا شماره…"
          className="flex-1 bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
          autoComplete="off"
          enterKeyHint="search"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              searchRef.current?.focus()
            }}
            aria-label="پاک کردن"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent active:bg-accent/80 touch-manipulation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        className={cn(
          'overflow-y-auto overscroll-contain',
          isTouch ? 'flex-1 min-h-0' : 'max-h-[55vh] min-h-[200px]',
        )}
      >
        {filtered.length > 0 ? (
          filtered.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => selectClient(client.id)}
              className={cn(
                'flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors touch-manipulation text-right',
                'hover:bg-accent/50 active:bg-accent',
                client.id === value && 'bg-primary/5',
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{client.name}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {client.isPlaceholder
                    ? 'اطلاعات ناقص'
                    : displayPhone(client.phone)}
                </p>
              </div>
              {client.id === value && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </button>
          ))
        ) : (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            مشتری‌ای یافت نشد
          </div>
        )}
      </div>

      {isDeviceContactPickerSupported() && (
        <div className="border-t border-border/60">
          <DeviceContactPickButton
            variant="list-item"
            onClick={() => void pickFromDevice()}
          />
        </div>
      )}

      <div className="border-t border-border/60">
        {!hasExactMatch && query.trim() ? (
          <button
            type="button"
            onClick={startAdding}
            className="flex min-h-12 w-full items-center gap-2.5 px-3 py-3 text-sm font-medium text-primary transition-colors touch-manipulation hover:bg-primary/5 active:bg-primary/10"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <UserPlus className="h-3.5 w-3.5" />
            </div>
            <span className="truncate">
              افزودن «{query.trim()}» به عنوان مشتری جدید
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startAdding}
            className="flex min-h-12 w-full items-center gap-2.5 px-3 py-3 text-sm text-muted-foreground transition-colors touch-manipulation hover:bg-accent/50 active:bg-accent"
          >
            <Plus className="h-4 w-4" />
            <span>مشتری جدید</span>
          </button>
        )}
      </div>
    </>
  )

  const addingBody = (
    <div className="p-3 space-y-3 overflow-y-auto">
      {!isTouch && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">مشتری جدید</p>
          <button
            type="button"
            onClick={cancelAdding}
            className="text-xs text-muted-foreground hover:text-foreground touch-manipulation"
          >
            بازگشت
          </button>
        </div>
      )}

      <Input
        value={newName}
        onChange={(e) => setValue('name', e.target.value)}
        placeholder="نام مشتری"
      />

      <Input
        value={displayPhone(newPhone)}
        onChange={(e) => setValue('phone', e.target.value)}
        placeholder="شماره تماس (۰۹…)"
        type="tel"
        inputMode="numeric"
        dir="ltr"
        className="text-left tabular-nums"
      />

      {errors.name && (
        <p className="text-xs text-destructive">{errors.name.message}</p>
      )}
      {errors.phone && (
        <p className="text-xs text-destructive">{errors.phone.message}</p>
      )}

      <div className={cn('flex gap-2', isTouch && 'flex-col-reverse')}>
        {isTouch && (
          <Button
            type="button"
            variant="outline"
            className="w-full touch-manipulation"
            onClick={cancelAdding}
          >
            بازگشت
          </Button>
        )}
        <Button
          type="button"
          size={isTouch ? 'default' : 'sm'}
          className="w-full touch-manipulation"
          disabled={isSubmitting || !newName.trim() || !newPhone.trim()}
          onClick={() => void handleSaveNew()}
        >
          {isSubmitting ? (
            <Spinner className="ml-1.5 h-3.5 w-3.5" />
          ) : (
            <Plus className="ml-1.5 h-3.5 w-3.5" />
          )}
          {isSubmitting ? 'در حال ذخیره…' : 'ذخیره و انتخاب'}
        </Button>
      </div>
    </div>
  )

  const phoneSheet = (
    <DeviceContactPhoneSheet nested={isTouch} {...phoneSheetProps} />
  )

  const showBesideContactAction =
    contactActionPlacement === 'beside' && isDeviceContactPickerSupported()

  const besideContactAction = showBesideContactAction ? (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="افزودن از مخاطبین"
      className="h-9 w-9 touch:h-11 touch:w-11 shrink-0 bg-blush-soft hover:bg-secondary/60"
      onClick={() => void pickFromDevice()}
    >
      <Contact aria-hidden="true" className="size-4" />
    </Button>
  ) : null

  const wrapWithContactAction = (node: React.ReactNode) => {
    if (!showBesideContactAction) return node
    return (
      <div className="flex w-full min-w-0 gap-2">
        <div className="min-w-0 flex-1">{node}</div>
        {besideContactAction}
      </div>
    )
  }

  if (isTouch) {
    return (
      <>
        {wrapWithContactAction(
          <DrawerNested
            open={mode !== 'closed'}
            onOpenChange={(next) => {
              if (next) {
                if (mode === 'closed') openSearch()
              } else {
                setMode('closed')
                setQuery('')
                reset({ name: '', phone: '', notes: '', tags: [] })
                resetPhoneSheet()
              }
            }}
            repositionInputs={false}
          >
            <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
            <DrawerContent
              showClose={false}
              className="max-h-[88dvh] pb-[var(--keyboard-inset,0px)] transition-[padding-bottom] duration-150"
            >
              <DrawerHeader>
                <DrawerTitle>
                  {mode === 'adding' ? 'مشتری جدید' : 'انتخاب مشتری'}
                </DrawerTitle>
              </DrawerHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {mode === 'adding' ? addingBody : searchingBody}
              </div>
            </DrawerContent>
            {phoneSheet}
          </DrawerNested>,
        )}
      </>
    )
  }

  if (mode === 'closed') {
    return (
      <>
        {wrapWithContactAction(triggerButton)}
        {phoneSheet}
      </>
    )
  }

  return (
    <>
      {wrapWithContactAction(
        <div
          ref={containerRef}
          className="rounded-xl border border-primary/30 bg-card shadow-sm overflow-hidden"
        >
          {mode === 'searching' && searchingBody}
          {mode === 'adding' && addingBody}
        </div>,
      )}
      {phoneSheet}
    </>
  )
}
