import { Redis } from "ioredis"
import { createClient } from "redis"
import { afterAll, describe, expect, it } from "vitest"
import { fixedWindow } from "#lib/algorithms/algorithms.ts"
import { testStore } from "#lib/store/__tests__/conformance.ts"
import { redisStore } from "#lib/stores/redis/redis-store.ts"

// Needs a Redis server at REDIS_URL.
const url = process.env.REDIS_URL ?? "redis://localhost:6379"

const ioredis = new Redis(url)
const nodeRedis = await createClient({ url }).connect()

afterAll(async () => {
  await Promise.all([ioredis.quit(), nodeRedis.close()])
})

describe.each([
  { client: ioredis, name: "ioredis" },
  { client: nodeRedis, name: "node-redis" },
])("redisStore with $name", ({ client }) => {
  testStore(() => redisStore(client))

  it("reloads its scripts after the server forgets them", async () => {
    const store = redisStore(client)
    const algorithm = fixedWindow({ limit: 5, window: 2000 })
    await store.consume({ algorithm, cost: 1, key: "test:flush" })

    await ioredis.script("FLUSH")

    expect(await store.consume({ algorithm, cost: 0, key: "test:flush" })).toMatchObject({
      success: true,
    })
  })
})
