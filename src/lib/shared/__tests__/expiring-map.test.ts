import { describe, expect, it } from "vitest"
import { expiringMap } from "#lib/shared/expiring-map.ts"

describe("expiringMap", () => {
  it("hides an entry from its expiry time", () => {
    const clock = { now: 0 }
    const map = expiringMap<{ expiresAt: number }>(() => clock.now)
    map.set("a", { expiresAt: 100 })

    clock.now = 99
    expect(map.get("a")).toEqual({ expiresAt: 100 })

    clock.now = 100
    expect(map.get("a")).toBeUndefined()
  })

  it("removes expired entries it never reads", () => {
    const clock = { now: 0 }
    const map = expiringMap<{ expiresAt: number }>(() => clock.now)
    map.set("a", { expiresAt: 100 })
    map.set("b", { expiresAt: 100 })

    clock.now = 60_000
    map.set("c", { expiresAt: 120_000 })

    expect(map.size).toBe(1)
  })
})
