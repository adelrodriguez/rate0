---
"rate0": minor
---

Add atomic rate limiting: `buildLimiter`, `rateLimit`, `remaining`, `clear`, and `headers`; the fixed window, sliding window, and token bucket algorithms; a memory store at `rate0/stores/memory`; and stores that take each client as it is: `rate0/stores/redis` for ioredis and node-redis, `rate0/stores/valkey` for iovalkey, and `rate0/stores/bun-redis` for `Bun.RedisClient`.
