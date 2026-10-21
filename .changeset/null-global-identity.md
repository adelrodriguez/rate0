---
"rate0": minor
---

Accept `null` as the global identity. Every request whose identity is `null` shares one count, so `identify` can return `null` for a global limit or for a request without the header it reads.
