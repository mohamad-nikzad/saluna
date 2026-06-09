interface ContactProperty {
  name?: string[]
  tel?: string[]
}

interface ContactsManager {
  select(
    properties: ('name' | 'tel')[],
    options?: { multiple?: boolean },
  ): Promise<ContactProperty[]>
}

interface Navigator {
  readonly contacts?: ContactsManager
}
