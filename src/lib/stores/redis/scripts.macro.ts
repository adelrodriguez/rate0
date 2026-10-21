import { readFileSync } from "node:fs"

/**
 * Build-time macro that inlines a Lua script from this folder into the bundle, so the store never
 * reads files at run time.
 */
export function readScript(file: string): string {
  return readFileSync(new URL(file, import.meta.url), "utf8")
}
