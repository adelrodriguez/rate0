/**
 * The value a limiter counts against. A tuple combines several parts, such as an IP and a user.
 * `null` is the global identity: every request that returns it shares one count.
 */
export type Identity = string | readonly [string, ...string[]] | null

// Escaping never produces a raw `%` followed by `00`, so no other identity has this key.
const GLOBAL = "%00"

function escape(part: string) {
  return part.replaceAll("%", "%25").replaceAll(":", "%3A").replaceAll("|", "%7C")
}

// Builds `name:part|part`. The parts never contain a raw `:` or `|`, so the last `:` always
// separates the name from the identity, and different identities always produce different keys,
// even when a name contains `:`.
export function keyOf(name: string, identity: Identity) {
  if (identity === null) return `${name}:${GLOBAL}`

  const parts = typeof identity === "string" ? [identity] : identity

  return `${name}:${parts.map((part) => escape(part)).join("|")}`
}
