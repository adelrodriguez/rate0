import { InvalidOptionError } from "#lib/shared/errors.ts"

export function positiveInteger(option: string, value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidOptionError(option, value, "a positive integer")
  }

  return value
}
