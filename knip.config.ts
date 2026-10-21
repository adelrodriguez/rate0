import type { KnipConfig } from "knip"
import analyze from "adamantite/analyze"

export default {
  ...analyze,
  entry: ["src/__tests__/types.test-d.ts"],
  ignore: [],
  ignoreFiles: [],
  project: ["src/**/*.ts"],
} satisfies KnipConfig
