import { Link } from '@tanstack/react-router'
import { MessageCircle, Plus, RotateCcw } from 'lucide-react'
import type { ManagerSupportTicketListItem } from '@repo/api-client/types'
import { Button } from '@repo/ui/button'
import { Skeleton } from '@repo/ui/skeleton'
import { cn } from '@repo/ui/utils'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import {
  supportCategoryLabels,
  SupportTicketStatus,
} from './support-ticket-status'

const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function SupportTicketCard({
  ticket,
}: {
  ticket: ManagerSupportTicketListItem
}) {
  return (
    <Link
      to="/support/$ticketId"
      params={{ ticketId: ticket.id }}
      className={cn(
        'block rounded-[18px] border bg-card p-4 transition-colors active:bg-accent/40',
        ticket.managerHasUnread
          ? 'border-primary/35 shadow-sm'
          : 'border-line-soft',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-1 size-2 shrink-0 rounded-full',
            ticket.managerHasUnread ? 'bg-primary' : 'bg-transparent',
          )}
        />
        {ticket.managerHasUnread ? (
          <span className="sr-only">خوانده‌نشده</span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2
              className={cn(
                'truncate text-sm text-foreground',
                ticket.managerHasUnread ? 'font-extrabold' : 'font-semibold',
              )}
            >
              {ticket.subject}
            </h2>
            <SupportTicketStatus status={ticket.status} />
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            {supportCategoryLabels[ticket.category]} ·{' '}
            {dateFormatter.format(new Date(ticket.lastActivityAt))}
          </div>
          {ticket.lastMessage ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
              <span className="font-semibold text-foreground/75">
                {ticket.lastMessage.authorDisplayName}:{' '}
              </span>
              {ticket.lastMessage.body}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

export function SupportTicketList({
  items,
}: {
  items: ManagerSupportTicketListItem[]
}) {
  const newestFirst = [...items].sort(
    (a, b) =>
      new Date(b.lastActivityAt).getTime() -
      new Date(a.lastActivityAt).getTime(),
  )
  return (
    <div className="space-y-2.5">
      {newestFirst.map((ticket) => (
        <SupportTicketCard key={ticket.id} ticket={ticket} />
      ))}
    </div>
  )
}

export function SupportTicketPagination({
  page,
  hasNext,
  onPageChange,
}: {
  page: number
  hasNext: boolean
  onPageChange: (page: number) => void
}) {
  if (page === 1 && !hasNext) return null
  return (
    <div className="mt-4">
      <div className="flex gap-2">
        {page > 1 ? (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onPageChange(page - 1)}
          >
            صفحه قبل
          </Button>
        ) : null}
        {hasNext ? (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onPageChange(page + 1)}
          >
            صفحه بعد
          </Button>
        ) : null}
      </div>
      <div className="mt-2 text-center text-xs text-muted-foreground">
        صفحه {toPersianDigits(page)}
      </div>
    </div>
  )
}

export function SupportTicketEmpty() {
  return (
    <div className="flex flex-col items-center rounded-[22px] border border-dashed border-line-soft bg-card/60 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-blush-soft text-plum-deep">
        <MessageCircle className="size-6" />
      </div>
      <h2 className="mt-4 font-bold">هنوز درخواستی ندارید</h2>
      <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
        پرسش، مشکل یا پیشنهادتان را مستقیم با پشتیبانی سالونا در میان بگذارید.
      </p>
      <Button asChild size="lg" className="mt-5">
        <Link to="/support/new">
          <Plus />
          درخواست جدید
        </Link>
      </Button>
    </div>
  )
}

export function SupportTicketListSkeleton() {
  return (
    <div className="space-y-3" aria-label="در حال بارگذاری">
      <Skeleton className="h-32 rounded-[18px]" />
      <Skeleton className="h-32 rounded-[18px]" />
      <Skeleton className="h-32 rounded-[18px]" />
    </div>
  )
}
export function SupportTicketListError({ retry }: { retry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-[18px] border border-destructive/25 bg-destructive-soft p-5 text-center"
    >
      <p className="text-sm text-destructive">دریافت درخواست‌ها انجام نشد.</p>
      <Button variant="outline" className="mt-3" onClick={retry}>
        <RotateCcw />
        تلاش دوباره
      </Button>
    </div>
  )
}
