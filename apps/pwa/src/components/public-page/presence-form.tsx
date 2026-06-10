import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  EMPTY_PRESENCE_INPUT,
  presenceSchema,
  presenceToInput,
} from '@repo/salon-core/forms/presence'
import type {
  PresenceInput,
  PresencePayload,
} from '@repo/salon-core/forms/presence'
import { Button } from '@repo/ui/button'
import { FormRootError } from '@repo/ui/form'
import { Spinner } from '@repo/ui/spinner'

import { getMutationErrorMessage } from '#/lib/query-client'
import {
  getApiV1SalonProfilePresenceQueryKey,
  salonPresenceQueryOptions,
  useUpdateSalonPresenceMutation,
} from '#/lib/salon-profile-queries'

import { PresenceFields } from './presence-fields'
import {
  getFirstInvalidPresenceField,
  revealInvalidPresenceField,
} from './presence-validation'

export type UsePresenceFormOptions = {
  onSuccess?: () => void
  invalidatesQuery?: QueryKey | readonly QueryKey[]
}

export function usePresenceForm(options: UsePresenceFormOptions = {}) {
  const [open, setOpen] = useState<keyof PresenceInput | null>(null)

  const presenceQuery = useQuery(salonPresenceQueryOptions())

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    watch,
    formState: { errors },
  } = useForm<PresenceInput, unknown, PresencePayload>({
    resolver: zodResolver(presenceSchema),
    defaultValues: EMPTY_PRESENCE_INPUT,
  })

  const values = watch()

  useEffect(() => {
    const presence = presenceQuery.data?.presence
    if (presence) {
      reset(presenceToInput(presence))
    }
  }, [presenceQuery.data, reset])

  const savePresence = useUpdateSalonPresenceMutation(
    options.invalidatesQuery ?? getApiV1SalonProfilePresenceQueryKey(),
  )

  const onInvalid = (fieldErrors: FieldErrors<PresenceInput>) => {
    const firstInvalidField = getFirstInvalidPresenceField(fieldErrors)
    if (!firstInvalidField) return
    revealInvalidPresenceField(firstInvalidField, { setOpen, setFocus })
  }

  const onSubmit = handleSubmit((formValues) => {
    savePresence.mutate(formValues, {
      onSuccess: () => options.onSuccess?.(),
      onError: (err) => {
        setError('root', {
          message: getMutationErrorMessage(err, 'ذخیره اطلاعات انجام نشد'),
        })
      },
    })
  }, onInvalid)

  return {
    open,
    setOpen,
    register,
    errors,
    values,
    onSubmit,
    isPending: savePresence.isPending,
    isLoading: presenceQuery.isPending,
    rootError: errors.root?.message,
  }
}

export type PresenceFormBodyProps = Pick<
  ReturnType<typeof usePresenceForm>,
  'open' | 'setOpen' | 'register' | 'errors' | 'values' | 'rootError'
>

export function PresenceFormBody({
  open,
  setOpen,
  register,
  errors,
  values,
  rootError,
}: PresenceFormBodyProps) {
  return (
    <>
      <PresenceFields
        register={register}
        errors={errors}
        values={values}
        open={open}
        setOpen={setOpen}
      />
      <FormRootError message={rootError} />
    </>
  )
}

export function PresenceEditor({ onSaved }: { onSaved: () => void }) {
  const presence = usePresenceForm({ onSuccess: onSaved })

  if (presence.isLoading) {
    return (
      <div className="grid place-items-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <form
      onSubmit={presence.onSubmit}
      noValidate
      className="flex flex-col gap-5"
    >
      <PresenceFormBody {...presence} />
      <Button type="submit" disabled={presence.isPending}>
        {presence.isPending ? 'در حال ذخیره…' : 'ذخیره'}
      </Button>
    </form>
  )
}
