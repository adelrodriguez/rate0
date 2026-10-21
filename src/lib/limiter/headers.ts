import type { LimitResult } from "#lib/limiter/build-limiter.ts"

/**
 * Builds the `RateLimit-Policy` and `RateLimit` headers of the IETF RateLimit header fields draft,
 * and `Retry-After` for a denial. A store error has no counts, and a dry run must not change what
 * clients see, so both produce no headers.
 */
export function headers(result: LimitResult): Record<string, string> {
  if (result.reason === "storeError" || result.reason === "dryRun") return {}

  const name = `"${result.name.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
  const resetSeconds = Math.ceil(result.retryAfter / 1000)

  return {
    RateLimit: `${name};r=${result.remaining};t=${resetSeconds}`,
    "RateLimit-Policy": `${name};q=${result.limit};w=${Math.ceil(result.window / 1000)}`,
    ...(result.success ? {} : { "Retry-After": String(resetSeconds) }),
  }
}
