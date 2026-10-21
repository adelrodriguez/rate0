import type { Store } from "#lib/store/store.ts"
import { scriptStore } from "./script-store.ts"

/**
 * The part of an iovalkey client the store uses.
 */
export type IovalkeyClient = {
  call(command: string, args: string[]): Promise<unknown>
}

/**
 * Counts in Valkey through an iovalkey client. Each check runs one Lua script, so it is atomic
 * across all instances that share the server.
 */
export function valkeyStore(client: IovalkeyClient): Store {
  return scriptStore((command, args) => client.call(command, args))
}
