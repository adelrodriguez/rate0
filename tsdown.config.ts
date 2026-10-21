import { defineConfig } from "tsdown"
import { Macros } from "unplugin-macros"

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: "src/index.ts",
    "stores/bun-redis": "src/stores/bun-redis.ts",
    "stores/memory": "src/stores/memory.ts",
    "stores/redis": "src/stores/redis.ts",
    "stores/valkey": "src/stores/valkey.ts",
  },
  fixedExtension: false,
  minify: true,
  outDir: "dist",
  platform: "node",
  plugins: [Macros.rolldown()],
  sourcemap: false,
  tsconfig: "tsconfig.build.json",
})
