import type { FocusEvent } from 'react'

export function scrollFocusedInputIntoView(target: EventTarget | null) {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    window.setTimeout(() => {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      })
    }, 300)
  }
}

export function handleFormFocusScroll(event: FocusEvent<HTMLElement>) {
  scrollFocusedInputIntoView(event.target)
}
