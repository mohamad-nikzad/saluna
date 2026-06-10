import type { ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@repo/ui/sheet'
import { cn } from '@repo/ui/utils'

export function BottomDrawer({
  trigger,
  title,
  padded = false,
  children,
}: {
  trigger: ReactNode
  title: string
  padded?: boolean
  children: ReactNode
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="flex max-h-[88dvh] flex-col gap-0 p-0"
      >
        <SheetHeader className="shrink-0 border-b py-4 pe-12 ps-5">
          <SheetTitle className="text-right">{title}</SheetTitle>
        </SheetHeader>
        <div
          className={cn('min-h-0 flex-1 overflow-auto', padded && 'px-5 py-5')}
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
