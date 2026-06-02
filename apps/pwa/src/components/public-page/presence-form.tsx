import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  EMPTY_PRESENCE_INPUT,
  presenceSchema,
  presenceToInput
  
} from '@repo/salon-core/forms/presence'
import type {
  PresenceInput,
  PresencePayload,
} from '@repo/salon-core/forms/presence'
import { Button } from '@repo/ui/button'
import { FormRootError } from '@repo/ui/form'
import { Spinner } from '@repo/ui/spinner'

import { api } from '#/lib/api-client'
import { getMutationErrorMessage } from '#/lib/query-client'
import { salonPresenceQueryKey } from '#/lib/query-keys'

import { PresenceFields } from './presence-fields'

export type UsePresenceFormOptions = {
  onSuccess?: () => void
  invalidatesQuery?: QueryKey | readonly QueryKey[]
}

export function usePresenceForm(options: UsePresenceFormOptions = {}) {
  const [open, setOpen] = useState<keyof PresenceInput | null>(null)

  const presenceQuery = useQuery({
    queryKey: salonPresenceQueryKey,
    queryFn: ({ signal }) => api.salonProfile.getPresence({ signal }),
  })

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<PresenceInput, any, PresencePayload>({
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

  const savePresence = useMutation({
    mutationFn: (formValues: PresencePayload) =>
      api.salonProfile.updatePresence(formValues),
    meta: {
      skipToast: true,
      invalidatesQuery: options.invalidatesQuery ?? salonPresenceQueryKey,
    },
    onSuccess: () => options.onSuccess?.(),
  })

  const onSubmit = handleSubmit((formValues) => {
    savePresence.mutate(formValues, {
      onError: (err) => {
        setError('root', {
          message: getMutationErrorMessage(err, 'ذخیره اطلاعات انجام نشد'),
        })
      },
    })
  })

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
