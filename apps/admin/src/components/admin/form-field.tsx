import { Input } from '#/components/ui/input'

export function FormField({
  label,
  name,
  defaultValue,
  placeholder,
  pattern,
  type = 'text',
  required,
  readOnly,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  pattern?: string
  type?: string
  required?: boolean
  readOnly?: boolean
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        pattern={pattern}
        required={required}
        readOnly={readOnly}
      />
    </label>
  )
}

export function TextAreaField({
  label,
  name,
  defaultValue,
  placeholder,
  rows,
  required,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  rows: number
  required?: boolean
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </label>
  )
}
