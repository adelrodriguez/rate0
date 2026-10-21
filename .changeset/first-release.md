---
"rate0": minor
---

Add atomic rate limiting: `buildLimiter`, `rateLimit`, `remaining`, `clear`, and `headers`; the fixed window, sliding window, and token bucket algorithms; a memory store; and a Redis store at `rate0/redis` for ioredis, Bun, and Valkey.
