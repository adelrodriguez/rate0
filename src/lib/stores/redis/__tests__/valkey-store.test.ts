import { Valkey } from "iovalkey"
import { afterAll, describe, expect, it } from "vitest"
import { fixedWindow } from "#lib/algorithms/algorithms.ts"
import { testStore } from "#lib/store/__tests__/conformance.ts"
import { valkeyStore } from "#lib/stores/redis/valkey-store.ts"

// Needs a Valkey server at REDIS_URL.
const url = process.env.REDIS_URL ?? "redis://localhost:6379"

const client = new Valkey(url)
const clientA = new Valkey(url, { keyPrefix: "test:a:" })
const clientB = new Valkey(url, { keyPrefix: "test:b:" })

afterAll(async () => {
  await Promise.all([client.quit(), clientA.quit(), clientB.quit()])
})

describe("valkeyStore with iovalkey", () => {
  testStore(() => valkeyStore(client))

  it("reloads its scripts after the server forgets them", async () => {
    const store = valkeyStore(client)
    const algorithm = fixedWindow({ limit: 5, window: 2000 })
    await store.consume({ algorithm, cost: 1, key: "test:flush" })

    await client.script("FLUSH")

    expect(await store.consume({ algorithm, cost: 0, key: "test:flush" })).toMatchObject({
      success: true,
    })
  })

  it("keeps the counts of clients with different key prefixes apart", async () => {
    const storeA = valkeyStore(clientA)
    const storeB = valkeyStore(clientB)
    const algorithm = fixedWindow({ limit: 1, window: 60_000 })
    const key = crypto.randomUUID()

    expect(await storeA.consume({ algorithm, cost: 1, key })).toMatchObject({ success: true })
    expect(await storeB.consume({ algorithm, cost: 1, key })).toMatchObject({ success: true })
    expect(await client.exists(`test:a:${key}`, `test:b:${key}`, key)).toBe(2)

    await storeA.clear(key)

    expect(await client.exists(`test:a:${key}`, `test:b:${key}`)).toBe(1)
    expect(await storeB.consume({ algorithm, cost: 1, key })).toMatchObject({ success: false })
  })
})
