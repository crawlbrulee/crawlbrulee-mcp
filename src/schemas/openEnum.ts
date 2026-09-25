import { z } from 'zod'

/**
 * A response enum the api may extend later. The known values still show up in the
 * tool's output schema, so a reader sees them, but any string is accepted: a value
 * added on the server must not make a validating host refuse the whole result.
 *
 * Output only. Request enums stay closed, so a typo in tool input is still caught.
 */
export function openEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.union([z.enum(values), z.string()])
}
