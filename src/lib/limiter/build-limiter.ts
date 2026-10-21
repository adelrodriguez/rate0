import type { Algorithm } from "#lib/algorithms/algorithms.ts"
import type { Identity } from "#lib/limiter/identity.ts"
import type { Store, StoreResult } from "#lib/store/store.ts"
import { capacityOf, windowOf } from "#lib/algorithms/algorithms.ts"
import { blockedCache } from "#lib/limiter/blocked-cache.ts"
import { keyOf } from "#lib/limiter/identity.ts"
import { InvalidOptionError, StoreError, StoreTimeoutError } from "#lib/shared/errors.ts"
import { positiveInteger } from "#lib/shared/options.ts"

const DEFAULT_TIMEOUT = 1000

/**
 * `"enforce"` refuses denied requests. `"dryRun"` counts normally but lets them through.
 */
export type Mode = "enforce" | "dryRun"

export type LimiterSettings = {
  /**
   * How long to wait for the store in milliseconds. Defaults to 1000.
   */
  readonly timeout?: number
  /**
   * Remember denials in this process until they reset, to skip the store. Defaults to `true`.
   */
  readonly cache?: boolean
  /**
   * Defaults to `"enforce"`.
   */
  readonly mode?: Mode
}

export type BuildLimiterOptions<Supported extends Algorithm> = LimiterSettings & {
  readonly store: Store<Supported>
}

export type LimiterOptions<Supported extends Algorithm> = LimiterSettings & {
  /**
   * Labels results and headers, and starts every key. Printable ASCII only.
   */
  readonly name: string
  readonly algorithm: Supported
}

export type Identify<Input> = (input: Input) => Identity | Promise<Identity>

type Counts = {
  readonly limit: number
  readonly remaining: number
  /**
   * When a denied request can succeed, or when the window ends, in epoch ms.
   */
  readonly reset: number
  /**
   * Milliseconds until `reset`, measured on the store's clock.
   */
  readonly retryAfter: number
  /**
   * The period the limit covers in milliseconds.
   */
  readonly window: number
}

export type AllowedResult = Counts & {
  readonly name: string
  readonly success: true
  /**
   * `"store"`: the store allowed the request. `"dryRun"`: the store denied it, in dry-run mode.
   */
  readonly reason: "store" | "dryRun"
}

export type DeniedResult = Counts & {
  readonly name: string
  readonly success: false
  /**
   * `"store"`: the store denied the request. `"cache"`: a remembered denial did.
   */
  readonly reason: "store" | "cache"
}

/**
 * The store failed or timed out, so nothing was counted.
 */
export type StoreErrorResult = {
  readonly name: string
  readonly success: false
  readonly reason: "storeError"
  readonly error: StoreError
}

export type LimitResult = AllowedResult | DeniedResult | StoreErrorResult

export type Remaining = {
  readonly name: string
  readonly limit: number
  readonly remaining: number
  readonly reset: number
}

export const internal = Symbol("rate0.limiter")

type Internal<Input> = {
  readonly capacity: number
  readonly consume: (input: Input, cost: number) => Promise<LimitResult>
  readonly read: (input: Input) => Promise<Remaining>
  readonly clear: (input: Input) => Promise<void>
}

/**
 * A limit definition. Run it with `rateLimit`, `remaining`, and `clear`.
 */
export type Limiter<in Input = Identity> = {
  readonly name: string
  readonly [internal]: Internal<Input>
}

export type DefineLimiter<Supported extends Algorithm> = {
  <Input>(
    options: LimiterOptions<Supported> & { readonly identify: Identify<Input> }
  ): Limiter<Input>
  (options: LimiterOptions<Supported> & { readonly identify?: undefined }): Limiter
}

/**
 * Binds a store and shared settings, and returns a function that defines limiters. Settings on a
 * limiter override the settings given here.
 */
export function buildLimiter<Supported extends Algorithm>({
  store,
  ...defaults
}: BuildLimiterOptions<Supported>): DefineLimiter<Supported> {
  function define<Input>(
    options: LimiterOptions<Supported>,
    identify: Identify<Input>
  ): Limiter<Input> {
    const name = printableName(options.name)
    const { algorithm } = options
    const timeout = positiveInteger(
      "timeout",
      options.timeout ?? defaults.timeout ?? DEFAULT_TIMEOUT
    )
    const mode = options.mode ?? defaults.mode ?? "enforce"
    const blocks = (options.cache ?? defaults.cache ?? true) ? blockedCache() : undefined
    const limit = capacityOf(algorithm)
    const window = windowOf(algorithm)

    async function keyFor(input: Input) {
      return keyOf(name, await identify(input))
    }

    function ask(key: string, cost: number) {
      return withTimeout(store.consume({ algorithm, cost, key }), timeout)
    }

    function counts({ now, remaining, reset }: StoreResult) {
      return { limit, remaining, reset, retryAfter: Math.max(0, reset - now), window }
    }

    return {
      [internal]: {
        capacity: limit,

        clear: async (input) => {
          const key = await keyFor(input)
          blocks?.clear(key)

          try {
            await withTimeout(store.clear(key), timeout)
          } catch (error) {
            throw new StoreError(error)
          }
        },

        consume: async (input, cost) => {
          const key = await keyFor(input)
          const blocked = mode === "enforce" ? blocks?.lookup(key, cost) : undefined

          if (blocked !== undefined) {
            return { ...blocked, limit, name, reason: "cache", success: false, window }
          }

          let result: StoreResult

          try {
            result = await ask(key, cost)
          } catch (error) {
            return { error: new StoreError(error), name, reason: "storeError", success: false }
          }

          if (result.success) return { ...counts(result), name, reason: "store", success: true }
          if (mode === "dryRun") return { ...counts(result), name, reason: "dryRun", success: true }

          blocks?.block(key, cost, result)

          return { ...counts(result), name, reason: "store", success: false }
        },

        read: async (input) => {
          const key = await keyFor(input)

          try {
            const { remaining, reset } = await ask(key, 0)
            return { limit, name, remaining, reset }
          } catch (error) {
            throw new StoreError(error)
          }
        },
      },
      name,
    }
  }

  function limiter<Input>(
    options: LimiterOptions<Supported> & { readonly identify: Identify<Input> }
  ): Limiter<Input>
  function limiter(options: LimiterOptions<Supported> & { readonly identify?: undefined }): Limiter
  function limiter<Input>(
    options: LimiterOptions<Supported> & { readonly identify?: Identify<Input> | undefined }
  ): Limiter<Input> | Limiter {
    if (options.identify === undefined) return define(options, (identity: Identity) => identity)

    return define(options, options.identify)
  }

  return limiter
}

// Header values quote the name, so it must be printable ASCII.
function printableName(name: string) {
  if (!/^[ -~]+$/u.test(name)) {
    throw new InvalidOptionError("name", name, "a non-empty string of printable ASCII characters")
  }

  return name
}

async function withTimeout<Value>(promise: Promise<Value>, timeout: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new StoreTimeoutError(timeout))
    }, timeout)
  })

  try {
    return await Promise.race([promise, expired])
  } finally {
    clearTimeout(timer)
  }
}
