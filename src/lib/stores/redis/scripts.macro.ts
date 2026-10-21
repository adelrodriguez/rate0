import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineMacro } from "unplugin-macros"

/**
 * Build-time macro that inlines a Lua script from this folder into the bundle, so the store never
 * reads files at run time. It registers the script as a watched input, so editing a `.lua` file
 * rebuilds in watch mode.
 */
export const readScript = defineMacro(function readScript(file: string): string {
  const path = fileURLToPath(new URL(file, import.meta.url))
  this.unpluginContext.addWatchFile(path)
  return readFileSync(path, "utf8")
})
