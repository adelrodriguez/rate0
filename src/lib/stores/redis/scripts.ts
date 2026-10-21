// Each script reads the clock with TIME, so every instance agrees on window boundaries. Redis 5 and
// later replicate the script's writes, not the script, which makes TIME safe to call before a write.
// Each script returns { success, remaining, reset, now } with 1 for success and 0 for a denial.
// The arithmetic matches the memory store line for line.

const now = `
local time = redis.call("TIME")
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
`

// KEYS[1]: state key. ARGV: limit, window size in ms, cost.
export const fixedWindow = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local size = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
${now}
local window = math.floor(now / size)
local reset = (window + 1) * size
local state = redis.call("HMGET", key, "window", "count")
local count = 0

if tonumber(state[1]) == window then
  count = tonumber(state[2]) or 0
end

if count + cost > limit then
  return { 0, limit - count, reset, now }
end

if cost > 0 then
  redis.call("HSET", key, "window", window, "count", count + cost)
  redis.call("PEXPIREAT", key, reset)
end

return { 1, limit - count - cost, reset, now }
`

// KEYS[1]: state key. ARGV: limit, window size in ms, cost.
export const slidingWindow = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local size = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
${now}
local window = math.floor(now / size)
local start = window * size
local state = redis.call("HMGET", key, "window", "current", "previous")
local stored = tonumber(state[1])
local current = 0
local previous = 0

if stored == window then
  current = tonumber(state[2]) or 0
  previous = tonumber(state[3]) or 0
elseif stored == window - 1 then
  previous = tonumber(state[2]) or 0
end

local used = math.floor(previous * (size - (now - start)) / size) + current

if used + cost > limit then
  local room = limit - current - cost
  local reset

  if room >= 0 then
    reset = math.min(start + math.floor(size * (previous - room - 1) / previous) + 1, start + size)
  else
    local nextRoom = limit - cost
    reset = math.min(start + size + math.floor(size * (current - nextRoom - 1) / current) + 1, start + 2 * size)
  end

  return { 0, math.max(0, limit - used), reset, now }
end

if cost > 0 then
  redis.call("HSET", key, "window", window, "current", current + cost, "previous", previous)
  redis.call("PEXPIREAT", key, start + 2 * size)
end

return { 1, limit - used - cost, start + size, now }
`

// KEYS[1]: state key. ARGV: refill rate, interval in ms, capacity, cost.
export const tokenBucket = `
local key = KEYS[1]
local refillRate = tonumber(ARGV[1])
local interval = tonumber(ARGV[2])
local capacity = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
${now}
local state = redis.call("HMGET", key, "tokens", "refilledAt")
local storedTokens = tonumber(state[1])
local storedAt = tonumber(state[2])
local tokens = capacity
local refilledAt = now

if storedTokens and storedAt then
  local refills = math.max(0, math.floor((now - storedAt) / interval))
  tokens = math.min(capacity, storedTokens + refills * refillRate)
  refilledAt = storedAt + refills * interval
end

if tokens < cost then
  return { 0, tokens, refilledAt + math.ceil((cost - tokens) / refillRate) * interval, now }
end

local remaining = tokens - cost

if cost > 0 then
  redis.call("HSET", key, "tokens", remaining, "refilledAt", refilledAt)
  redis.call("PEXPIREAT", key, refilledAt + math.ceil((capacity - remaining) / refillRate) * interval)
end

return { 1, remaining, refilledAt + interval, now }
`
