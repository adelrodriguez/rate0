import type { Store } from "#lib/store/store.ts"
import { scriptStore } from "./script-store.ts"

/**
 * The part of an ioredis client the store uses.
 */
export type IoredisClient = {
  call(command: string, args: string[]): Promise<unknown>
}

/**
 * The part of a node-redis client the store uses.
 */
export type NodeRedisClient = {
  sendCommand(args: string[]): Promise<unknown>
}

/**
 * Counts in Redis through an ioredis or node-redis client. Each check runs one Lua script, so it is
 * atomic across all instances that share the server.
 */
export function redisStore(client: IoredisClient | NodeRedisClient): Store {
  if ("call" in client) return scriptStore((command, args) => client.call(command, args))

  return scriptStore((command, args) => client.sendCommand([command, ...args]))
}
