import type { RefObject } from 'react'
import { Checkbox } from '@repo/ui/checkbox'
import { Input } from '@repo/ui/input'
import { Field, FieldLabel, FieldError } from '@repo/ui/field'
import type { Client } from '@repo/salon-core/types'
import { ClientPicker } from '#/components/calendar/client-picker'

const FILL_LATER_LABEL = 'بعداً اطلاعات مشتری را کامل می‌کنم'

type AppointmentClientFieldProps = {
  checkboxId: string
  useTemporaryClient: boolean
  onTemporaryClientModeChange: (enabled: boolean) => void
  togglePlacement?: 'above' | 'below'
  toggleVariant?: 'subtle' | 'prominent'
  clients: Client[]
  clientId: string
  onClientChange: (clientId: string) => void
  onClientCreated: (client: Client) => void
  clientIdError?: string
  hostActive?: boolean
  contactActionPlacement?: 'list' | 'beside'
  temporaryClientName: string
  onTemporaryClientNameChange: (value: string) => void
  temporaryClientNameRef?: RefObject<HTMLInputElement | null>
  temporaryClientNameError?: string
  temporaryClientNotes: string
  onTemporaryClientNotesChange: (value: string) => void
}

function TemporaryClientToggle({
  checkboxId,
  useTemporaryClient,
  onTemporaryClientModeChange,
  toggleVariant,
}: Pick<
  AppointmentClientFieldProps,
  | 'checkboxId'
  | 'useTemporaryClient'
  | 'onTemporaryClientModeChange'
  | 'toggleVariant'
>) {
  if (toggleVariant === 'subtle') {
    return (
      <label
        htmlFor={checkboxId}
        className="flex cursor-pointer items-center gap-2"
      >
        <Checkbox
          id={checkboxId}
          checked={useTemporaryClient}
          onCheckedChange={(checked) =>
            onTemporaryClientModeChange(checked === true)
          }
        />
        <span className="text-xs font-normal text-muted-foreground">
          {FILL_LATER_LABEL}
        </span>
      </label>
    )
  }

  return (
    <label
      htmlFor={checkboxId}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-card px-3 py-3"
    >
      <Checkbox
        id={checkboxId}
        checked={useTemporaryClient}
        onCheckedChange={(checked) =>
          onTemporaryClientModeChange(checked === true)
        }
        className="mt-0.5"
      />
      <div className="space-y-1">
        <p className="text-sm font-medium">{FILL_LATER_LABEL}</p>
        <p className="text-xs text-muted-foreground">
          در حالت موقت فقط یک نام نمایشی نگه می‌داریم و شماره تماس بعداً تکمیل
          می‌شود.
        </p>
      </div>
    </label>
  )
}

function TemporaryClientFields({
  nameInputId,
  notesInputId,
  temporaryClientName,
  onTemporaryClientNameChange,
  temporaryClientNameRef,
  temporaryClientNameError,
  temporaryClientNotes,
  onTemporaryClientNotesChange,
}: Pick<
  AppointmentClientFieldProps,
  | 'temporaryClientName'
  | 'onTemporaryClientNameChange'
  | 'temporaryClientNameRef'
  | 'temporaryClientNameError'
  | 'temporaryClientNotes'
  | 'onTemporaryClientNotesChange'
> & {
  nameInputId: string
  notesInputId: string
}) {
  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <Field className="gap-2">
        <FieldLabel htmlFor={nameInputId}>نام مشتری</FieldLabel>
        <Input
          id={nameInputId}
          ref={temporaryClientNameRef}
          value={temporaryClientName}
          onChange={(event) => onTemporaryClientNameChange(event.target.value)}
          placeholder="مثلاً دوستِ سارا"
        />
        {temporaryClientNameError && (
          <FieldError>{temporaryClientNameError}</FieldError>
        )}
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor={notesInputId}>یادداشت (اختیاری)</FieldLabel>
        <Input
          id={notesInputId}
          value={temporaryClientNotes}
          onChange={(event) => onTemporaryClientNotesChange(event.target.value)}
          placeholder="مثلاً شماره را بعداً می‌گیرم"
        />
      </Field>
    </div>
  )
}

export function AppointmentClientField({
  checkboxId,
  useTemporaryClient,
  onTemporaryClientModeChange,
  togglePlacement = 'above',
  toggleVariant = 'prominent',
  clients,
  clientId,
  onClientChange,
  onClientCreated,
  clientIdError,
  hostActive,
  contactActionPlacement,
  temporaryClientName,
  onTemporaryClientNameChange,
  temporaryClientNameRef,
  temporaryClientNameError,
  temporaryClientNotes,
  onTemporaryClientNotesChange,
}: AppointmentClientFieldProps) {
  const toggle = (
    <TemporaryClientToggle
      checkboxId={checkboxId}
      useTemporaryClient={useTemporaryClient}
      onTemporaryClientModeChange={onTemporaryClientModeChange}
      toggleVariant={toggleVariant}
    />
  )

  const clientInput = useTemporaryClient ? (
    <TemporaryClientFields
      nameInputId={`${checkboxId}-name`}
      notesInputId={`${checkboxId}-notes`}
      temporaryClientName={temporaryClientName}
      onTemporaryClientNameChange={onTemporaryClientNameChange}
      temporaryClientNameRef={temporaryClientNameRef}
      temporaryClientNameError={temporaryClientNameError}
      temporaryClientNotes={temporaryClientNotes}
      onTemporaryClientNotesChange={onTemporaryClientNotesChange}
    />
  ) : (
    <>
      <ClientPicker
        clients={clients}
        value={clientId}
        hostActive={hostActive}
        contactActionPlacement={contactActionPlacement}
        onChange={onClientChange}
        onClientCreated={onClientCreated}
      />
      {clientIdError && <FieldError>{clientIdError}</FieldError>}
    </>
  )

  return (
    <div className="space-y-3">
      {togglePlacement === 'above' ? toggle : null}
      {clientInput}
      {togglePlacement === 'below' ? toggle : null}
    </div>
  )
}
