import type { StoreResult } from "#lib/store/store.ts"
import { expiringMap } from "#lib/shared/expiring-map.ts"

type Block = {
  readonly cost: number
  readonly remaining: number
  readonly reset: number
  /**
   * The local time at which the block ends, in epoch ms.
   */
  readonly expiresAt: number
}

// Remembers denials in this process, so a denied identity does not reach the store again until its
// reset. A denial for one cost also covers every larger cost, because a larger request cannot
// succeed earlier. The block lasts as long as the store said to wait, measured on the local clock,
// so a local clock that differs from the store's clock does not change its length.
export function blockedCache() {
  const blocks = expiringMap<Block>(Date.now)

  return {
    block(key: string, cost: number, { now, remaining, reset }: StoreResult) {
      blocks.set(key, { cost, expiresAt: Date.now() + (reset - now), remaining, reset })
    },

    clear(key: string) {
      blocks.delete(key)
    },

    lookup(key: string, cost: number) {
      const block = blocks.get(key)

      if (block === undefined || cost < block.cost) return

      return {
        remaining: block.remaining,
        reset: block.reset,
        retryAfter: Math.max(0, block.expiresAt - Date.now()),
      }
    },
  }
}
