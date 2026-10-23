---
"richter": minor
---

Add atomic rate limiting: `buildLimiter`, `rateLimit`, `remaining`, `clear`, and `headers`; the fixed window, sliding window, and token bucket algorithms; a memory store at `richter/stores/memory`; and stores that take each client as it is: `richter/stores/redis` for ioredis and node-redis, `richter/stores/valkey` for iovalkey, and `richter/stores/bun-redis` for `Bun.RedisClient`.
