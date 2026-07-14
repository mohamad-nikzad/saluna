'use client'

import { SearchIcon, XIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from './utils'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from './input-group'

const DEFAULT_CLEAR_LABEL = 'پاک کردن جستجو'

type SearchInputProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  clearable?: boolean
  clearLabel?: string
  containerClassName?: string
}

function SearchInput({
  className,
  containerClassName,
  clearable = false,
  clearLabel = DEFAULT_CLEAR_LABEL,
  value,
  defaultValue,
  onChange,
  disabled,
  placeholder,
  'aria-label': ariaLabel,
  ref,
  ...props
}: SearchInputProps & { ref?: React.Ref<HTMLInputElement> }) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const isControlled = value !== undefined
  const [uncontrolledValue, setUncontrolledValue] = React.useState(
    () => defaultValue?.toString() ?? '',
  )
  const currentValue = isControlled
    ? value?.toString() ?? ''
    : uncontrolledValue
  const showClear = clearable && currentValue.length > 0 && !disabled

  function assignRef(node: HTMLInputElement | null) {
    inputRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!isControlled) {
      setUncontrolledValue(event.target.value)
    }
    onChange?.(event)
  }

  function handleClear() {
    if (!isControlled) {
      setUncontrolledValue('')
    }

    onChange?.({
      target: { value: '' },
      currentTarget: { value: '' },
    } as React.ChangeEvent<HTMLInputElement>)
    inputRef.current?.focus()
  }

  return (
    <InputGroup
      className={cn(
        'bg-blush-soft',
        disabled && 'opacity-50',
        containerClassName,
      )}
      data-disabled={disabled ? '' : undefined}
    >
      <InputGroupInput
        ref={assignRef}
        type="search"
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
          className,
        )}
        {...props}
      />
      <InputGroupAddon align="inline-start">
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      {showClear ? (
        <InputGroupAddon align="inline-end">
          {/* Dense icon inside the search field; clearing is also reachable via select-all + delete. */}
          <InputGroupButton
            size="icon-xs"
            aria-label={clearLabel}
            onClick={handleClear}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}

export { SearchInput }
export type { SearchInputProps }
