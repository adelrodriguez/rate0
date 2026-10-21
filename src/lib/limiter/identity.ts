/**
 * The value a limiter counts against. A tuple combines several parts, such as an IP and a user.
 */
export type Identity = string | readonly [string, ...string[]]

function escape(part: string) {
  return part.replaceAll("%", "%25").replaceAll(":", "%3A").replaceAll("|", "%7C")
}

// Builds `name:part|part`. The parts never contain a raw `:` or `|`, so the last `:` always
// separates the name from the identity, and different identities always produce different keys,
// even when a name contains `:`.
export function keyOf(name: string, identity: Identity) {
  const parts = typeof identity === "string" ? [identity] : identity

  return `${name}:${parts.map((part) => escape(part)).join("|")}`
}
