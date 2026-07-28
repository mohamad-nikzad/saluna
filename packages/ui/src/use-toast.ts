'use client'

import * as React from 'react'
import { toast as sonnerToast } from 'sonner'

import type { ToastActionElement, ToastProps } from './toast'

const TOAST_LIMIT = 1

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  open?: boolean
}

type ToastInput = Omit<ToasterToast, 'id'>

type ActiveToast = {
  id: string
  open: boolean
  title?: React.ReactNode
  description?: React.ReactNode
}

const activeToasts = new Map<string, ActiveToast>()
const listeners = new Set<(toasts: ActiveToast[]) => void>()

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

function notify() {
  const snapshot = Array.from(activeToasts.values())
  listeners.forEach((listener) => listener(snapshot))
}

function track(toast: ActiveToast) {
  activeToasts.set(toast.id, toast)
  // Match prior TOAST_LIMIT behavior for getActiveToasts consumers.
  if (activeToasts.size > TOAST_LIMIT) {
    const oldestId = activeToasts.keys().next().value
    if (oldestId && oldestId !== toast.id) {
      activeToasts.delete(oldestId)
      sonnerToast.dismiss(oldestId)
    }
  }
  notify()
}

function untrack(id: string) {
  const existing = activeToasts.get(id)
  if (!existing) return
  activeToasts.set(id, { ...existing, open: false })
  notify()
  activeToasts.delete(id)
  notify()
}

function extractAction(action: ToastActionElement | undefined) {
  if (!action || !React.isValidElement(action)) return undefined

  const props = action.props as {
    children?: React.ReactNode
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
    altText?: string
  }

  const label =
    typeof props.children === 'string' || typeof props.children === 'number'
      ? String(props.children)
      : (props.altText ?? 'Action')

  return {
    label,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      props.onClick?.(event)
    },
  }
}

function showSonnerToast(id: string, props: ToastInput) {
  const message = props.title ?? props.description ?? ''
  const description = props.title ? props.description : undefined
  const action = extractAction(props.action)
  const duration =
    props.duration === Infinity
      ? Infinity
      : typeof props.duration === 'number'
        ? props.duration
        : undefined

  const options = {
    id,
    description,
    duration,
    action,
    onDismiss: () => {
      props.onOpenChange?.(false)
      untrack(id)
    },
    onAutoClose: () => {
      props.onOpenChange?.(false)
      untrack(id)
    },
  }

  if (props.variant === 'success') {
    sonnerToast.success(message, options)
  } else if (props.variant === 'destructive') {
    sonnerToast.error(message, options)
  } else {
    sonnerToast(message, options)
  }
}

function toast({ onOpenChange, ...props }: ToastInput) {
  const id = genId()

  track({
    id,
    open: true,
    title: props.title,
    description: props.description,
  })

  showSonnerToast(id, { ...props, onOpenChange })

  const dismiss = () => {
    sonnerToast.dismiss(id)
    onOpenChange?.(false)
    untrack(id)
  }

  const update = (next: ToasterToast) => {
    const merged: ToastInput = {
      ...props,
      ...next,
      onOpenChange,
    }
    track({
      id,
      open: true,
      title: merged.title,
      description: merged.description,
    })
    showSonnerToast(id, merged)
  }

  return {
    id,
    dismiss,
    update,
  }
}

function getActiveToasts() {
  return Array.from(activeToasts.values())
}

function useToast() {
  const [toasts, setToasts] = React.useState<ActiveToast[]>(() =>
    Array.from(activeToasts.values()),
  )

  React.useEffect(() => {
    listeners.add(setToasts)
    setToasts(Array.from(activeToasts.values()))
    return () => {
      listeners.delete(setToasts)
    }
  }, [])

  return {
    toasts,
    toast,
    dismiss: (toastId?: string) => {
      if (toastId) {
        sonnerToast.dismiss(toastId)
        untrack(toastId)
        return
      }
      sonnerToast.dismiss()
      activeToasts.clear()
      notify()
    },
  }
}

export { useToast, toast, getActiveToasts }
