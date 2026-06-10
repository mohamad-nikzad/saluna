import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { XIcon } from 'lucide-react'
import { cn } from '@repo/ui/utils'
import { useKeyboardInset } from '#/lib/use-keyboard-inset'
import { handleFormFocusScroll } from '#/lib/scroll-focused-input-into-view'

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
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      dismissible={false}
      repositionInputs={false}
      data-slot="form-sheet"
    >
      {children}
    </DrawerPrimitive.Root>
  )
}

function FormSheetContent({
  className,
  children,
  onRequestClose,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  onRequestClose: () => void
}) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay
        data-slot="form-sheet-overlay"
        className="fixed inset-0 z-50 bg-foreground/35 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DrawerPrimitive.Content
        data-slot="form-sheet-content"
        className={cn(
          'fixed inset-x-0 bottom-0 top-0 z-50 flex h-dvh max-h-dvh flex-col overflow-hidden bg-card',
          'overscroll-contain',
          'pb-[var(--keyboard-inset,0px)] transition-[padding-bottom] duration-150',
          className,
        )}
        {...props}
      >
        <button
          type="button"
          onClick={onRequestClose}
          aria-label="بستن"
          className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] inset-e-3 z-10 flex size-10 items-center justify-center rounded-full bg-secondary/70 text-foreground/75 transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <XIcon className="size-4" />
        </button>
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  )
}

function FormSheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="form-sheet-header"
      className={cn(
        'shrink-0 flex flex-col gap-0.5 border-b border-line-soft bg-card px-5 pb-4 pe-14 text-right',
        'pt-[calc(0.75rem+env(safe-area-inset-top))]',
        className,
      )}
      {...props}
    />
  )
}

function FormSheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="form-sheet-title"
      className={cn('text-foreground text-lg font-bold', className)}
      {...props}
    />
  )
}

function FormSheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
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
