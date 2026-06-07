/** Recursive type: Date fields become ISO strings, matching JSON response wire format. */
export type JsonSerialized<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? JsonSerialized<U>[]
    : T extends object
      ? { [K in keyof T]: JsonSerialized<T[K]> }
      : T

/**
 * Prepare DB entities for OpenAPI-typed JSON responses.
 * Uses the same Date → ISO string conversion as `c.json()` at runtime.
 */
export function jsonSerialized<T>(value: T): JsonSerialized<T> {
  return JSON.parse(JSON.stringify(value)) as JsonSerialized<T>
}
