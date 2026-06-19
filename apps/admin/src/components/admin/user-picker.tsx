import { getApiV1AdminUsersOptions } from '@repo/api-client/query'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'

import { Input } from '#/components/ui/input'
import { text } from '#/lib/admin-format'
import { cn } from '#/lib/utils'

const SEARCH_DEBOUNCE_MS = 300
const RESULT_PAGE_SIZE = 20

type UserRow = Record<string, unknown>

type DisplayUser = {
  userId: string
  name?: string
  email?: string
  phoneNumber?: string
}

export function UserPicker({
  name = 'userId',
  readOnly = false,
  displayUser,
  required = false,
}: {
  name?: string
  readOnly?: boolean
  displayUser?: DisplayUser
  required?: boolean
}) {
  if (readOnly && displayUser) {
    return <UserPickerReadOnly name={name} user={displayUser} />
  }

  return <UserPickerSearch name={name} required={required} />
}

function UserPickerReadOnly({
  name,
  user,
}: {
  name: string
  user: DisplayUser
}) {
  const labelId = useId()

  return (
    <div className="block space-y-1.5 text-sm">
      <span id={labelId} className="text-muted-foreground">
        کاربر
      </span>
      <div
        aria-labelledby={labelId}
        className="rounded-md border border-input bg-muted/30 px-3 py-2"
      >
        <div className="font-medium">{user.name || '-'}</div>
        <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {user.email ? (
            <div>
              <dt className="sr-only">ایمیل</dt>
              <dd>ایمیل: {user.email}</dd>
            </div>
          ) : null}
          {user.phoneNumber ? (
            <div>
              <dt className="sr-only">تلفن</dt>
              <dd>تلفن: {user.phoneNumber}</dd>
            </div>
          ) : null}
          <div>
            <dt className="sr-only">شناسه کاربر</dt>
            <dd>شناسه کاربر: {user.userId}</dd>
          </div>
        </dl>
      </div>
      <input type="hidden" name={name} value={user.userId} />
    </div>
  )
}

function UserPickerSearch({
  name,
  required,
}: {
  name: string
  required?: boolean
}) {
  const listboxId = useId()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const debounceRef = useRef<number | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)

  const usersQuery = useQuery({
    ...getApiV1AdminUsersOptions({
      query: {
        page: 1,
        pageSize: RESULT_PAGE_SIZE,
        search: debouncedSearch || undefined,
      },
    }),
    enabled: isOpen && debouncedSearch.length > 0,
  })

  const users = usersQuery.data?.items ?? []

  useEffect(() => {
    return () => {
      window.clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function handleSearchChange(value: string) {
    setSearchInput(value)
    setSelectedUser(null)
    setIsOpen(true)
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setDebouncedSearch(value.trim())
    }, SEARCH_DEBOUNCE_MS)
  }

  function handleSelect(user: UserRow) {
    setSelectedUser(user)
    setSearchInput(userLabel(user))
    setDebouncedSearch('')
    setIsOpen(false)
  }

  function handleClearSelection() {
    setSelectedUser(null)
    setSearchInput('')
    setDebouncedSearch('')
    setIsOpen(false)
  }

  const selectedUserId = selectedUser ? text(selectedUser.id) : ''

  return (
    <div ref={containerRef} className="relative block space-y-1.5 text-sm">
      <label htmlFor={`${listboxId}-search`} className="text-muted-foreground">
        کاربر
      </label>
      <Input
        id={`${listboxId}-search`}
        value={searchInput}
        onChange={(event) => handleSearchChange(event.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder="جستجو بر اساس نام، ایمیل، تلفن یا نام کاربری..."
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen && debouncedSearch.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
      />
      <input
        type="hidden"
        name={name}
        value={selectedUserId}
        required={required}
      />
      {selectedUser ? (
        <SelectedUserSummary user={selectedUser} onClear={handleClearSelection} />
      ) : null}
      {isOpen && debouncedSearch.length > 0 ? (
        <UserPickerDropdown
          listboxId={listboxId}
          users={users}
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          onSelect={handleSelect}
        />
      ) : null}
    </div>
  )
}

function SelectedUserSummary({
  user,
  onClear,
}: {
  user: UserRow
  onClear: () => void
}) {
  return (
    <div className="rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-foreground">{userLabel(user)}</div>
          <div className="mt-0.5 truncate">{userDetails(user)}</div>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-foreground underline-offset-4 hover:underline"
          onClick={onClear}
        >
          تغییر
        </button>
      </div>
    </div>
  )
}

function UserPickerDropdown({
  listboxId,
  users,
  isLoading,
  isError,
  onSelect,
}: {
  listboxId: string
  users: UserRow[]
  isLoading: boolean
  isError: boolean
  onSelect: (user: UserRow) => void
}) {
  return (
    <div
      id={listboxId}
      role="listbox"
      className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md"
    >
      {isLoading ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          در حال جستجوی کاربران...
        </div>
      ) : null}
      {!isLoading && isError ? (
        <div className="px-3 py-2 text-sm text-destructive">
          بارگذاری کاربران ناموفق بود.
        </div>
      ) : null}
      {!isLoading && !isError && users.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          کاربری یافت نشد.
        </div>
      ) : null}
      {!isLoading && !isError
        ? users.map((user) => {
            const id = text(user.id)
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={false}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-start text-sm last:border-b-0',
                  'hover:bg-accent hover:text-accent-foreground',
                )}
                onClick={() => onSelect(user)}
              >
                <span className="font-medium">{userLabel(user)}</span>
                <span className="text-xs text-muted-foreground">
                  {userDetails(user)}
                </span>
              </button>
            )
          })
        : null}
    </div>
  )
}

function userLabel(user: UserRow): string {
  return text(user.name) || text(user.username) || 'کاربر بدون نام'
}

function userDetails(user: UserRow): string {
  return [
    text(user.email),
    text(user.phoneNumber),
    `شناسه: ${text(user.id)}`,
  ]
    .filter(Boolean)
    .join(' · ')
}
