import { RedisClient } from "bun"
import { afterAll, describe, expect, it } from "vitest"
import { fixedWindow } from "#lib/algorithms/algorithms.ts"
import { testStore } from "#lib/store/__tests__/conformance.ts"
import { bunStore } from "#lib/stores/redis/bun-store.ts"

// Needs Bun and a Redis server at REDIS_URL. Run it with `bun --bun vitest run --project bun-store`.
const url = process.env.REDIS_URL ?? "redis://localhost:6379"

const client = new RedisClient(url)

afterAll(() => {
  client.close()
})

describe("bunStore with Bun.RedisClient", () => {
  testStore(() => bunStore(client))

  it("reloads its scripts after the server forgets them", async () => {
    const store = bunStore(client)
    const algorithm = fixedWindow({ limit: 5, window: 2000 })
    await store.consume({ algorithm, cost: 1, key: "test:flush" })

    await client.send("SCRIPT", ["FLUSH"])

    expect(await store.consume({ algorithm, cost: 0, key: "test:flush" })).toMatchObject({
      success: true,
    })
  })
})
