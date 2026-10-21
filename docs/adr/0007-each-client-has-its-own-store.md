# Each client has its own store

Supersedes [0002](0002-stores-take-a-command-function-not-a-client.md).

Each Redis-protocol client has its own store, and the store takes the client as it is: `redisStore` takes an ioredis or node-redis client, `valkeyStore` an iovalkey client, and `bunStore` a `Bun.RedisClient`. The user writes no adapter. Each store declares only the one method it calls (`call`, `sendCommand`, or `send`), so the package still imports no client's types, and every client fits without a type assertion. All of them adapt their client to one internal `scriptStore`, so they run the same scripts and count the same way.

## Considered Options

- **A command function, `send: (command, args) => Promise<unknown>` (0002).** It fits any client, but every user writes the same one-line adapter, and the README has to show it for each client.
- **One store for every client.** It would tell every client apart by shape, and the checks grow fragile as clients are added: ioredis also has a `sendCommand` method, with a different signature from node-redis's. `redisStore` tells only its two clients apart, by `call`, which node-redis lacks.

## Consequences

A new client gets its own store and its own CI job. Upstash Redis gets `upstashStore`, so `@upstash/redis` must fit without an adapter or a type assertion. Clients with a different command method, such as Valkey GLIDE, get a store that adapts that method.
