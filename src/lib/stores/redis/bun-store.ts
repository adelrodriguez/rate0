import type { Store } from "#lib/store/store.ts"
import { scriptStore } from "./script-store.ts"

/**
 * The part of a `Bun.RedisClient` the store uses.
 */
export type BunRedisClient = {
  send(command: string, args: string[]): Promise<unknown>
}

/**
 * Counts in Redis or Valkey through Bun's own Redis client. Each check runs one Lua script, so it
 * is atomic across all instances that share the server.
 */
export function bunStore(client: BunRedisClient): Store {
  return scriptStore((command, args) => client.send(command, args))
}
