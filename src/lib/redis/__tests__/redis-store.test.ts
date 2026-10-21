import { Redis } from "ioredis"
import { afterAll, describe, expect, it } from "vitest"
import type { RedisSend } from "#lib/redis/redis-store.ts"
import { fixedWindow, slidingWindow, tokenBucket } from "#lib/algorithms/algorithms.ts"
import { redisStore } from "#lib/redis/redis-store.ts"
import { InvalidReplyError } from "#lib/shared/errors.ts"
import { testStore } from "#lib/store/__tests__/conformance.ts"

// Needs a server that speaks the Redis protocol. CI runs this file against Redis and Valkey.
const url = process.env.REDIS_URL ?? "redis://localhost:6379"

type Client = { readonly name: string; readonly send: RedisSend; readonly close: () => unknown }

async function connectClients(): Promise<Client[]> {
  const ioredis = new Redis(url)
  const clients: Client[] = [
    {
      close: () => ioredis.quit(),
      name: "ioredis",
      send: (command, args) => ioredis.call(command, args),
    },
  ]

  // Bun's own client exists only when the tests run on Bun: `bun --bun vitest`.
  if ("Bun" in globalThis) {
    const { RedisClient } = await import("bun")
    const bun = new RedisClient(url)
    clients.push({
      close: () => {
        bun.close()
      },
      name: "Bun.RedisClient",
      send: (command, args) => bun.send(command, args),
    })
  }

  return clients
}

const clients = await connectClients()

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()))
})

describe.each(clients)("redisStore with $name", ({ send }) => {
  testStore(() => redisStore({ send }))

  it("reloads its scripts after the server forgets them", async () => {
    const store = redisStore({ send })
    const algorithm = fixedWindow({ limit: 5, window: 2000 })
    await store.consume({ algorithm, cost: 1, key: "test:flush" })

    await send("SCRIPT", ["FLUSH"])

    expect(await store.consume({ algorithm, cost: 0, key: "test:flush" })).toMatchObject({
      success: true,
    })
  })

  it.each([
    fixedWindow({ limit: 5, window: 2000 }),
    slidingWindow({ limit: 5, window: 2000 }),
    tokenBucket({ capacity: 5, interval: 2000, refillRate: 1 }),
  ])("expires $type state once it no longer matters", async (algorithm) => {
    const store = redisStore({ send })
    const key = `test:${crypto.randomUUID()}`
    await store.consume({ algorithm, cost: 1, key })

    const ttl = await send("PTTL", [key])

    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(4000)
  })

  it("rejects a reply it does not recognize", async () => {
    const store = redisStore({ send: () => Promise.resolve(["OK"]) })

    await expect(
      store.consume({ algorithm: fixedWindow({ limit: 5, window: 2000 }), cost: 1, key: "k" })
    ).rejects.toThrow(InvalidReplyError)
  })
})
