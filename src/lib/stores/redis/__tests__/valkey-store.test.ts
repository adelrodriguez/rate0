import { Valkey } from "iovalkey"
import { afterAll, describe, expect, it } from "vitest"
import { fixedWindow } from "#lib/algorithms/algorithms.ts"
import { testStore } from "#lib/store/__tests__/conformance.ts"
import { valkeyStore } from "#lib/stores/redis/valkey-store.ts"

// Needs a Valkey server at REDIS_URL.
const url = process.env.REDIS_URL ?? "redis://localhost:6379"

const client = new Valkey(url)

afterAll(async () => {
  await client.quit()
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
})
