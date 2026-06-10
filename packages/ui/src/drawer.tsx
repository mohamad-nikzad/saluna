'use client'

import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { XIcon } from 'lucide-react'

import { cn } from './utils'

function Drawer({
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      repositionInputs={repositionInputs}
      {...props}
    />
  )
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-foreground/35 backdrop-blur-[3px]',
        className,
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  showClose?: boolean
}) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          'group/drawer-content bg-card fixed z-50 flex h-auto min-h-0 flex-col overflow-hidden',
          'overscroll-contain',
          'data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80dvh] data-[vaul-drawer-direction=top]:rounded-b-[28px] data-[vaul-drawer-direction=top]:shadow-[0_12px_48px_-16px_rgba(42,20,25,0.28)]',
          'data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[88dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[28px] data-[vaul-drawer-direction=bottom]:shadow-[0_-12px_48px_-16px_rgba(42,20,25,0.28)]',
          'data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm',
          'data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm',
          className,
        )}
        {...props}
      >
        <div className="bg-border mx-auto mt-3 hidden h-1.5 w-10 shrink-0 rounded-full group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {showClose && (
          <DrawerPrimitive.Close
            data-slot="drawer-close-x"
            className="absolute top-[calc(1rem+env(safe-area-inset-top))] inset-e-4 z-10 flex size-9 touch:size-11 items-center justify-center rounded-full bg-secondary/70 text-foreground/75 transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none"
          >
            <XIcon className="size-4" />
            <span className="sr-only">بستن</span>
          </DrawerPrimitive.Close>
        )}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        'shrink-0 flex flex-col gap-0.5 border-b border-line-soft px-5 pt-[calc(0.625rem+env(safe-area-inset-top))] pb-4 pe-14 text-right',
        className,
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        'shrink-0 mt-auto flex flex-col gap-2 border-t border-line-soft bg-card/95 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]',
        className,
      )}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn('text-foreground text-lg font-bold', className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn('text-muted-foreground text-[13px]', className)}
      {...props}
    />
  )
}

function DrawerNested({
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.NestedRoot>) {
  return (
    <DrawerPrimitive.NestedRoot
      data-slot="drawer-nested"
      repositionInputs={repositionInputs}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerNested,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
