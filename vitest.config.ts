import { Macros } from "unplugin-macros"
import { defineConfig } from "vitest/config"

const scriptTests = "src/lib/stores/redis/__tests__/script-store.test.ts"

// The unit tests need no server. Each store project needs its server at REDIS_URL, and `bun-redis-store`
// also needs Bun: `bun --bun vitest run --project bun-redis-store`.
export default defineConfig({
  plugins: [Macros.vite()],
  test: {
    coverage: {
      provider: "v8",
    },
    projects: [
      {
        extends: true,
        test: {
          exclude: ["src/lib/stores/redis/**"],
          include: ["src/**/*.test.ts"],
          name: "unit",
        },
      },
      {
        extends: true,
        test: {
          include: [scriptTests, "src/lib/stores/redis/__tests__/redis-store.test.ts"],
          name: "redis-store",
        },
      },
      {
        extends: true,
        test: {
          include: [scriptTests, "src/lib/stores/redis/__tests__/valkey-store.test.ts"],
          name: "valkey-store",
        },
      },
      {
        extends: true,
        test: {
          include: ["src/lib/stores/redis/__tests__/bun-redis-store.test.ts"],
          name: "bun-redis-store",
        },
      },
    ],
  },
})
