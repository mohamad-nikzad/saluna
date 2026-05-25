'use client'

import * as React from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerNested,
  DrawerTitle,
  DrawerTrigger,
} from '@repo/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/popover'
import { useIsTouch } from '@repo/ui/use-mobile'
import { cn } from '@repo/ui/utils'
import { useKeyboardInset } from '@/lib/use-keyboard-inset'

interface ResponsivePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Trigger element. Will be passed `asChild`, so render a single focusable element. */
  trigger: React.ReactNode
  /** Sheet title (mobile only). */
  title: React.ReactNode
  /** Optional sub-line under the title (mobile only). */
  description?: React.ReactNode
  /** Class applied to the desktop Popover content (e.g. width). */
  popoverContentClassName?: string
  /**
   * When the trigger lives inside another Vaul drawer (FormSheet, base Drawer,
   * etc.) keep this `true` so we open a nested drawer on touch devices.
   * Set to `false` for stand-alone pages.
   */
  nested?: boolean
  /**
   * The Command tree (search + list of items). On mobile it grows to fill the
   * sheet and respects the on-screen keyboard inset automatically.
   */
  children: React.ReactNode
}

export function ResponsivePicker({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  popoverContentClassName,
  nested = true,
  children,
}: ResponsivePickerProps) {
  const isTouch = useIsTouch()
  useKeyboardInset(isTouch && open)

  if (isTouch) {
    const Root = nested ? DrawerNested : Drawer
    return (
      <Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent
          showClose={false}
          className="max-h-[88lvh] pb-[var(--keyboard-inset,0px)] transition-[padding-bottom] duration-150"
        >
          <DrawerHeader className="pe-5">
            <DrawerTitle>{title}</DrawerTitle>
            {description ? (
              <DrawerDescription>{description}</DrawerDescription>
            ) : null}
          </DrawerHeader>
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden',
              // Force the inner Command tree to fill the sheet so its list
              // (not the sheet) is what scrolls. Caller-provided max-h on
              // the list is overridden here.
              '[&_[data-slot=command]]:flex-1 [&_[data-slot=command]]:min-h-0',
              '[&_[data-slot=command-list]]:!max-h-none [&_[data-slot=command-list]]:flex-1',
            )}
          >
            {children}
          </div>
        </DrawerContent>
      </Root>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn('p-0', popoverContentClassName)}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
