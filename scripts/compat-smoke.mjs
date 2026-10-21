// Checks that the built bundle runs on the minimum supported runtime.
//
// The floor is the `engines.node` version in package.json. The bundle must not import Node.js
// modules. This script also removes globals that are newer than the floor, so a run on a newer
// runtime fails in the same way as a run on the floor.
//
// Usage: node scripts/compat-smoke.mjs [dist directory]

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const distDir = resolve(process.argv[2] ?? "dist")
const entry = resolve(distDir, "index.js")

function check(condition, message) {
  if (!condition) {
    throw new Error(`Compatibility smoke test failed: ${message}`)
  }
}

const content = await readFile(entry, "utf8")
check(
  !/(?:from|import|require)\s*\(?\s*["']node:/.test(content),
  "the bundle imports no Node.js module"
)

if (typeof Array.prototype.toSorted !== "function") {
  throw new Error("This runtime is below the supported floor")
}

// Globals that Node.js added after 20.0.0.
delete RegExp.escape
delete Object.groupBy
delete Map.groupBy
delete Promise.withResolvers
delete Array.fromAsync
delete Error.isError
delete Math.sumPrecise
delete Set.prototype.difference
delete Set.prototype.intersection
delete Set.prototype.isDisjointFrom
delete Set.prototype.isSubsetOf
delete Set.prototype.isSupersetOf
delete Set.prototype.symmetricDifference
delete Set.prototype.union

/**
 * @type {typeof import("../src/index")}
 */
const library = await import(pathToFileURL(entry).href)

check(library.greet("Ada") === "Hello, Ada!", "greet returns a greeting")

try {
  library.greet(" ")
  check(false, "greet throws for a blank name")
} catch (error) {
  check(
    error instanceof library.InvalidNameError && error.value === " ",
    "InvalidNameError stores the input"
  )
}
