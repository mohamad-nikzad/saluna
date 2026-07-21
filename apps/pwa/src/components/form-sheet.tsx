import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { cn } from '@repo/ui/utils'
import { useKeyboardInset } from '#/lib/use-keyboard-inset'
import { handleFormFocusScroll } from '#/lib/scroll-focused-input-into-view'

const FormSheetOpenContext = React.createContext(false)

type FormSheetChromeValue = {
  onRequestClose: () => void
  closeButtonRef: React.RefObject<HTMLButtonElement | null>
}

const FormSheetChromeContext = React.createContext<FormSheetChromeValue | null>(
  null,
)

function FormSheetCloseButton({
  className,
}: {
  className?: string
}) {
  const chrome = React.useContext(FormSheetChromeContext)
  if (!chrome) return null
  return (
    <button
      ref={chrome.closeButtonRef}
      type="button"
      onClick={chrome.onRequestClose}
      aria-label="بستن"
      className={cn(
        'flex size-9 touch:size-11 shrink-0 items-center justify-center rounded-full bg-secondary/70 text-foreground/75 transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <XIcon className="size-4" />
    </button>
  )
}

function FormSheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  useKeyboardInset(open)
  return (
    <FormSheetOpenContext.Provider value={open}>
      <DialogPrimitive.Root
        modal={open}
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) onOpenChange(true)
        }}
      >
        {children}
      </DialogPrimitive.Root>
    </FormSheetOpenContext.Provider>
  )
}

function FormSheetContent({
  className,
  children,
  onRequestClose,
  onEscapeKeyDown,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  onRequestClose: () => void
}) {
  const open = React.useContext(FormSheetOpenContext)
  const closeButtonRef = React.useRef<HTMLButtonElement>(null)
  const chrome = React.useMemo(
    () => ({ onRequestClose, closeButtonRef }),
    [onRequestClose],
  )

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="form-sheet-overlay"
        style={{ pointerEvents: open ? undefined : 'none' }}
        className="fixed inset-0 z-50 bg-foreground/35 duration-200 will-change-[opacity] data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none"
      />
      <DialogPrimitive.Content
        data-slot="form-sheet-content"
        className={cn(
          'fixed inset-x-0 bottom-0 top-0 z-50 flex h-dvh max-h-dvh flex-col overflow-hidden bg-card will-change-transform',
          'overscroll-contain',
          'pb-[var(--keyboard-inset,0px)] transition-[padding-bottom] duration-200 data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full',
          'motion-reduce:animate-none motion-reduce:transition-none',
          className,
        )}
        onEscapeKeyDown={(event) => {
          onEscapeKeyDown?.(event)
          if (event.defaultPrevented) return
          event.preventDefault()
          onRequestClose()
        }}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event)
          if (event.defaultPrevented) return
          event.preventDefault()
          // Let the sheet paint before focus work on lower-end devices.
          window.setTimeout(() => {
            const closeButton = closeButtonRef.current
            if (closeButton?.closest('[data-state="open"]')) {
              closeButton.focus()
            }
          }, 100)
        }}
        {...props}
        aria-hidden={open ? undefined : true}
        inert={open ? undefined : true}
      >
        <FormSheetChromeContext.Provider value={chrome}>
          {children}
        </FormSheetChromeContext.Provider>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function FormSheetHeader({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="form-sheet-header"
      className={cn(
        'shrink-0 border-b border-line-soft bg-card px-5 pb-4 text-right',
        'pt-[calc(0.75rem+env(safe-area-inset-top))]',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
        <FormSheetCloseButton className="-me-1.5 -mt-0.5" />
      </div>
    </div>
  )
}

function FormSheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="form-sheet-title"
      className={cn('text-foreground text-lg font-bold', className)}
      {...props}
    />
  )
}

function FormSheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="form-sheet-description"
      className={cn('text-muted-foreground text-[13px]', className)}
      {...props}
    />
  )
}

function FormSheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="form-sheet-footer"
      className={cn(
        'shrink-0 mt-auto flex flex-col gap-2 border-t border-line-soft bg-card/95 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]',
        className,
      )}
      {...props}
    />
  )
}

function FormSheetBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="form-sheet-body"
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]',
        'pb-[calc(8rem+env(safe-area-inset-bottom))]',
        className,
      )}
      onFocus={handleFormFocusScroll}
      {...props}
    />
  )
}

export {
  FormSheet,
  FormSheetContent,
  FormSheetHeader,
  FormSheetTitle,
  FormSheetDescription,
  FormSheetFooter,
  FormSheetBody,
}
