import { Redis } from "ioredis"
import { createClient } from "redis"
import { afterAll, describe, expect, it } from "vitest"
import { fixedWindow } from "#lib/algorithms/algorithms.ts"
import { testStore } from "#lib/store/__tests__/conformance.ts"
import { redisStore } from "#lib/stores/redis/redis-store.ts"

// Needs a Redis server at REDIS_URL.
const url = process.env.REDIS_URL ?? "redis://localhost:6379"

const ioredis = new Redis(url)
const ioredisA = new Redis(url, { keyPrefix: "test:a:" })
const ioredisB = new Redis(url, { keyPrefix: "test:b:" })
const nodeRedis = await createClient({ url }).connect()
const nodeRedisA = await createClient({ keyPrefix: "test:a:", url }).connect()
const nodeRedisB = await createClient({ keyPrefix: "test:b:", url }).connect()

afterAll(async () => {
  await Promise.all([
    ioredis.quit(),
    ioredisA.quit(),
    ioredisB.quit(),
    nodeRedis.close(),
    nodeRedisA.close(),
    nodeRedisB.close(),
  ])
})

describe.each([
  { client: ioredis, clientA: ioredisA, clientB: ioredisB, name: "ioredis" },
  { client: nodeRedis, clientA: nodeRedisA, clientB: nodeRedisB, name: "node-redis" },
])("redisStore with $name", ({ client, clientA, clientB }) => {
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

  it("keeps the counts of clients with different key prefixes apart", async () => {
    const storeA = redisStore(clientA)
    const storeB = redisStore(clientB)
    const algorithm = fixedWindow({ limit: 1, window: 60_000 })
    const key = crypto.randomUUID()

    expect(await storeA.consume({ algorithm, cost: 1, key })).toMatchObject({ success: true })
    expect(await storeB.consume({ algorithm, cost: 1, key })).toMatchObject({ success: true })
    expect(await ioredis.exists(`test:a:${key}`, `test:b:${key}`, key)).toBe(2)

    await storeA.clear(key)

    expect(await ioredis.exists(`test:a:${key}`, `test:b:${key}`)).toBe(1)
    expect(await storeB.consume({ algorithm, cost: 1, key })).toMatchObject({ success: false })
  })
})
