import { describe, expect, it } from "vitest"
import { fixedWindow, slidingWindow, tokenBucket } from "#lib/algorithms/algorithms.ts"
import { testStore } from "#lib/store/__tests__/conformance.ts"
import { memoryStore } from "#lib/stores/memory/memory-store.ts"

function clockAt(start: number) {
  const clock = { now: start }
  return { clock, store: memoryStore({ clock: () => clock.now }) }
}

describe("memoryStore", () => {
  testStore(() => memoryStore())

  describe("slidingWindow", () => {
    const algorithm = slidingWindow({ limit: 10, window: 1000 })

    it("counts the previous window in proportion to its overlap", async () => {
      const { clock, store } = clockAt(10_000)
      await store.consume({ algorithm, cost: 8, key: "k" })

      // 25% into the next window, 75% of the previous window's 8 units still count.
      clock.now = 11_250

      expect(await store.consume({ algorithm, cost: 0, key: "k" })).toMatchObject({ remaining: 4 })
    })

    it("resets a denial at the first millisecond the request succeeds", async () => {
      const { clock, store } = clockAt(10_000)
      await store.consume({ algorithm, cost: 8, key: "k" })
      clock.now = 11_000
      await store.consume({ algorithm, cost: 2, key: "k" })

      const denied = await store.consume({ algorithm, cost: 1, key: "k" })
      expect(denied.success).toBe(false)

      clock.now = denied.reset - 1
      expect(await store.consume({ algorithm, cost: 1, key: "k" })).toMatchObject({
        success: false,
      })

      clock.now = denied.reset
      expect(await store.consume({ algorithm, cost: 1, key: "k" })).toMatchObject({ success: true })
    })

    it("waits for the next window when the current window alone is full", async () => {
      const { clock, store } = clockAt(10_000)
      await store.consume({ algorithm, cost: 10, key: "k" })

      const denied = await store.consume({ algorithm, cost: 4, key: "k" })
      // In the next window, floor(10 * (1 - elapsed)) must be at most 6: past 30% of the way in.
      expect(denied.reset).toBe(11_301)

      clock.now = 11_300
      expect(await store.consume({ algorithm, cost: 4, key: "k" })).toMatchObject({
        success: false,
      })

      clock.now = 11_301
      expect(await store.consume({ algorithm, cost: 4, key: "k" })).toMatchObject({ success: true })
    })

    it("forgets windows older than the previous window", async () => {
      const { clock, store } = clockAt(10_000)
      await store.consume({ algorithm, cost: 10, key: "k" })
      clock.now = 12_000

      expect(await store.consume({ algorithm, cost: 0, key: "k" })).toMatchObject({ remaining: 10 })
    })
  })

  describe("fixedWindow", () => {
    it("starts a new count in the next window", async () => {
      const algorithm = fixedWindow({ limit: 3, window: 1000 })
      const { clock, store } = clockAt(10_999)
      await store.consume({ algorithm, cost: 3, key: "k" })
      clock.now = 11_000

      expect(await store.consume({ algorithm, cost: 1, key: "k" })).toMatchObject({
        remaining: 2,
        reset: 12_000,
        success: true,
      })
    })
  })

  describe("tokenBucket", () => {
    const algorithm = tokenBucket({ capacity: 5, interval: 1000, refillRate: 2 })

    it("adds refillRate tokens per whole interval, up to the capacity", async () => {
      const { clock, store } = clockAt(10_000)
      await store.consume({ algorithm, cost: 5, key: "k" })

      clock.now = 11_999
      expect(await store.consume({ algorithm, cost: 0, key: "k" })).toMatchObject({ remaining: 2 })

      clock.now = 20_000
      expect(await store.consume({ algorithm, cost: 0, key: "k" })).toMatchObject({ remaining: 5 })
    })

    it("resets a denial when enough tokens refill for its cost", async () => {
      const { clock, store } = clockAt(10_000)
      await store.consume({ algorithm, cost: 5, key: "k" })

      const denied = await store.consume({ algorithm, cost: 3, key: "k" })
      expect(denied.reset).toBe(12_000)

      clock.now = 11_999
      expect(await store.consume({ algorithm, cost: 3, key: "k" })).toMatchObject({
        success: false,
      })

      clock.now = 12_000
      expect(await store.consume({ algorithm, cost: 3, key: "k" })).toMatchObject({ success: true })
    })

    it("keeps refills on the interval grid across requests", async () => {
      const { clock, store } = clockAt(10_000)
      await store.consume({ algorithm, cost: 5, key: "k" })
      clock.now = 11_500
      await store.consume({ algorithm, cost: 1, key: "k" })

      clock.now = 12_000
      expect(await store.consume({ algorithm, cost: 0, key: "k" })).toMatchObject({ remaining: 3 })
    })
  })
})
