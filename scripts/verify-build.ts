import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import packageJson from "../package.json" with { type: "json" }

const packageRoot = join(import.meta.dirname, "..")
const temporaryDirectory = mkdtempSync(join(tmpdir(), "rate0-build-"))
const exportPaths = [
  packageJson.module,
  packageJson.types,
  packageJson.exports["."].import,
  packageJson.exports["./stores/memory"].import,
  packageJson.exports["./stores/memory"].types,
  packageJson.exports["./stores/bun-redis"].import,
  packageJson.exports["./stores/bun-redis"].types,
  packageJson.exports["./stores/redis"].import,
  packageJson.exports["./stores/redis"].types,
  packageJson.exports["./stores/valkey"].import,
  packageJson.exports["./stores/valkey"].types,
]

function run(command: string, arguments_: string[], cwd: string) {
  execFileSync(command, arguments_, { cwd, stdio: "inherit" })
}

try {
  for (const exportPath of exportPaths) {
    const resolvedPath = join(packageRoot, exportPath)
    if (!existsSync(resolvedPath)) {
      throw new Error(`The package export does not exist: ${exportPath}`)
    }
  }

  run("pnpm", ["pack", "--pack-destination", temporaryDirectory], packageRoot)

  const tarballs = readdirSync(temporaryDirectory).filter((file) => file.endsWith(".tgz"))
  const [tarball] = tarballs
  if (!tarball || tarballs.length !== 1) {
    throw new Error(`Expected one package tarball, found ${tarballs.length}`)
  }

  const tarballPath = join(temporaryDirectory, tarball)
  writeFileSync(
    join(temporaryDirectory, "package.json"),
    `${JSON.stringify({ name: "rate0-build-verification", private: true, type: "module" }, null, 2)}\n`
  )
  run("npm", ["install", "--ignore-scripts", "--no-package-lock", tarballPath], temporaryDirectory)

  writeFileSync(
    join(temporaryDirectory, "runtime.mjs"),
    `import assert from "node:assert/strict"

import { buildLimiter, fixedWindow, InvalidOptionError, rateLimit } from "rate0"
import { memoryStore } from "rate0/stores/memory"
import { bunRedisStore } from "rate0/stores/bun-redis"
import { redisStore } from "rate0/stores/redis"
import { valkeyStore } from "rate0/stores/valkey"

const limiter = buildLimiter({ store: memoryStore() })
const perKey = limiter({ algorithm: fixedWindow({ limit: 1, window: 60_000 }), name: "key" })

assert.equal((await rateLimit(perKey, "a")).success, true)
assert.equal((await rateLimit(perKey, "a")).success, false)
assert.throws(() => fixedWindow({ limit: 0, window: 1 }), InvalidOptionError)
assert.equal(typeof bunRedisStore, "function")
assert.equal(typeof redisStore, "function")
assert.equal(typeof valkeyStore, "function")
`
  )
  run(process.execPath, ["runtime.mjs"], temporaryDirectory)

  writeFileSync(
    join(temporaryDirectory, "consumer.ts"),
    `import { buildLimiter, fixedWindow, rateLimit } from "rate0"
import type { LimitResult } from "rate0"
import { memoryStore } from "rate0/stores/memory"
import { redisStore } from "rate0/stores/redis"
import type { IoredisClient } from "rate0/stores/redis"

const limiter = buildLimiter({ store: memoryStore() })
const perIp = limiter({
  algorithm: fixedWindow({ limit: 1, window: 60_000 }),
  identify: (request: { ip: string }) => request.ip,
  name: "ip",
})
const result: Promise<LimitResult> = rateLimit(perIp, { ip: "203.0.113.7" })
const client: IoredisClient = { call: () => Promise.resolve([1, 0, 0, 0]) }

// @ts-expect-error -- perIp identifies a request, not a string.
void rateLimit(perIp, "203.0.113.7")

void [result, redisStore(client)]
`
  )
  writeFileSync(
    join(temporaryDirectory, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          strict: true,
          target: "ESNext",
        },
        files: ["consumer.ts"],
      },
      null,
      2
    )}\n`
  )

  run(
    process.execPath,
    [join(packageRoot, "node_modules/typescript/bin/tsc"), "--project", "tsconfig.json"],
    temporaryDirectory
  )

  console.info("Verified the packed runtime and declarations.")
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true })
}
