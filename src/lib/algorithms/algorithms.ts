import { positiveInteger } from "#lib/options/options.ts"

/**
 * Allows `limit` units in each window. Windows start at multiples of `window` since the epoch.
 */
export type FixedWindow = {
  readonly type: "fixedWindow"
  readonly limit: number
  readonly window: number
}

/**
 * Allows `limit` units in any period of `window`, weighting the previous window by its overlap.
 */
export type SlidingWindow = {
  readonly type: "slidingWindow"
  readonly limit: number
  readonly window: number
}

/**
 * Holds up to `capacity` tokens and adds `refillRate` tokens every `interval`.
 */
export type TokenBucket = {
  readonly type: "tokenBucket"
  readonly refillRate: number
  readonly interval: number
  readonly capacity: number
}

export type Algorithm = FixedWindow | SlidingWindow | TokenBucket

export type WindowOptions = {
  /**
   * The most units in one window.
   */
  readonly limit: number
  /**
   * The window length in milliseconds.
   */
  readonly window: number
}

export type TokenBucketOptions = {
  /**
   * The tokens added every `interval`.
   */
  readonly refillRate: number
  /**
   * The time between refills in milliseconds.
   */
  readonly interval: number
  /**
   * The most tokens the bucket holds. A new bucket starts full.
   */
  readonly capacity: number
}

export function fixedWindow({ limit, window }: WindowOptions): FixedWindow {
  return {
    limit: positiveInteger("limit", limit),
    type: "fixedWindow",
    window: positiveInteger("window", window),
  }
}

export function slidingWindow({ limit, window }: WindowOptions): SlidingWindow {
  return {
    limit: positiveInteger("limit", limit),
    type: "slidingWindow",
    window: positiveInteger("window", window),
  }
}

export function tokenBucket({ refillRate, interval, capacity }: TokenBucketOptions): TokenBucket {
  return {
    capacity: positiveInteger("capacity", capacity),
    interval: positiveInteger("interval", interval),
    refillRate: positiveInteger("refillRate", refillRate),
    type: "tokenBucket",
  }
}

/**
 * The most units one identity can spend at once.
 */
export function capacityOf(algorithm: Algorithm) {
  return algorithm.type === "tokenBucket" ? algorithm.capacity : algorithm.limit
}

/**
 * The period the limit covers in milliseconds. A token bucket refills completely in this time.
 */
export function windowOf(algorithm: Algorithm) {
  return algorithm.type === "tokenBucket"
    ? Math.ceil(algorithm.capacity / algorithm.refillRate) * algorithm.interval
    : algorithm.window
}
