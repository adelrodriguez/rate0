import { describe, expect, it } from "vitest"
import { headers } from "#lib/limiter/headers.ts"
import { StoreError } from "#lib/shared/errors.ts"

const counts = { limit: 30, remaining: 12, reset: 0, retryAfter: 1_799_001, window: 3_600_000 }

describe("headers", () => {
  it("describes the policy and the remaining units of an allowed request", () => {
    expect(headers({ ...counts, name: "suggestions:ip", reason: "store", success: true })).toEqual({
      RateLimit: '"suggestions:ip";r=12;t=1800',
      "RateLimit-Policy": '"suggestions:ip";q=30;w=3600',
    })
  })

  it("adds Retry-After to a denial", () => {
    expect(
      headers({ ...counts, name: "x", reason: "cache", remaining: 0, success: false })
    ).toMatchObject({
      "Retry-After": "1800",
    })
  })

  it("escapes quotes and backslashes in the name", () => {
    expect(headers({ ...counts, name: 'a"b\\c', reason: "store", success: true }).RateLimit).toBe(
      String.raw`"a\"b\\c";r=12;t=1800`
    )
  })

  it("produces no headers for a store error or a dry run", () => {
    expect(
      headers({
        error: new StoreError(new Error("down")),
        name: "x",
        reason: "storeError",
        success: false,
      })
    ).toEqual({})
    expect(headers({ ...counts, name: "x", reason: "dryRun", success: true })).toEqual({})
  })
})
