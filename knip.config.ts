import type { KnipConfig } from "knip"
import analyze from "adamantite/analyze"

export default {
  ...analyze,
  ignore: [],
  ignoreFiles: [],
  project: ["src/**/*.ts"],
} satisfies KnipConfig
