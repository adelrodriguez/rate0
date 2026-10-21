import type { Algorithm } from "#lib/algorithms/algorithms.ts"
import type { Store, StoreResult } from "#lib/store/store.ts"
import * as scripts from "./scripts.ts"

/**
 * Sends one command to Redis and returns its reply. Adapt any client in one line:
 *
 * - Ioredis: `(command, args) => redis.call(command, args)`
 * - Bun: `(command, args) => redis.send(command, args)`
 */
export type RedisSend = (command: string, args: string[]) => Promise<unknown>

export type RedisStoreOptions = {
  readonly send: RedisSend
}

type Script = { readonly source: string; readonly sha: Promise<string> }

/**
 * Counts in Redis, Valkey, or any server that speaks the Redis protocol and runs Lua scripts. Each
 * call runs one script, so it is atomic across all instances that share the server.
 */
export function redisStore({ send }: RedisStoreOptions): Store {
  const loaded = {
    fixedWindow: script(scripts.fixedWindow),
    slidingWindow: script(scripts.slidingWindow),
    tokenBucket: script(scripts.tokenBucket),
  }

  async function evaluate({ source, sha }: Script, key: string, args: string[]) {
    try {
      return await send("EVALSHA", [await sha, "1", key, ...args])
    } catch (error) {
      if (!isNoScriptError(error)) throw error

      // EVAL also caches the script, so later calls succeed with EVALSHA.
      return send("EVAL", [source, "1", key, ...args])
    }
  }

  return {
    clear: async (key) => {
      await send("DEL", [key])
    },

    consume: async ({ key, algorithm, cost }) =>
      parseReply(await evaluate(loaded[algorithm.type], key, scriptArgs(algorithm, cost))),
  }
}

function script(source: string): Script {
  return { sha: sha1(source), source }
}

async function sha1(source: string) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(source))

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function scriptArgs(algorithm: Algorithm, cost: number) {
  switch (algorithm.type) {
    case "fixedWindow":
    case "slidingWindow":
      return [String(algorithm.limit), String(algorithm.window), String(cost)]

    case "tokenBucket":
      return [
        String(algorithm.refillRate),
        String(algorithm.interval),
        String(algorithm.capacity),
        String(cost),
      ]
  }
}

function isNoScriptError(error: unknown) {
  return error instanceof Error && error.message.includes("NOSCRIPT")
}

function parseReply(reply: unknown): StoreResult {
  const values: unknown[] = Array.isArray(reply) ? reply : []
  const [success, remaining, reset, now] = values

  if (
    values.length !== 4
    || (success !== 0 && success !== 1)
    || typeof remaining !== "number"
    || typeof reset !== "number"
    || typeof now !== "number"
  ) {
    throw new InvalidReplyError(reply)
  }

  return { now, remaining, reset, success: success === 1 }
}

export class InvalidReplyError extends Error {
  override readonly name = "InvalidReplyError"
  readonly reply: unknown

  constructor(reply: unknown) {
    super("The store returned an unexpected reply to a rate limit script")
    this.reply = reply
  }
}
