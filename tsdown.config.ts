import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: "src/index.ts",
    "stores/memory": "src/stores/memory.ts",
    "stores/redis": "src/stores/redis.ts",
  },
  fixedExtension: false,
  minify: true,
  outDir: "dist",
  platform: "node",
  sourcemap: false,
  tsconfig: "tsconfig.build.json",
})
