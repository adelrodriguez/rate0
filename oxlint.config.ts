import core, { ignorePatterns } from "adamantite/lint"
import { defineConfig } from "oxlint"

export default defineConfig({
  extends: [core],
  ignorePatterns: [...ignorePatterns],
  options: {
    respectEslintDisableDirectives: true,
    typeAware: true,
    typeCheck: true,
  },
  overrides: [
    // Dependencies inside `src/lib` point one way:
    //
    //   shared <- algorithms <- store <- memory, redis
    //                                 <- limiter
    //
    // A limiter knows only the store contract, never a concrete store, and the stores know nothing
    // of each other or of limiters. Tests may cross these lines, so the rules cover source files only.
    {
      files: ["src/**/*.ts"],
      rules: {
        "import/no-relative-parent-imports": "error",
      },
    },
    {
      files: ["src/lib/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              { group: ["#index.ts", "#redis.ts"], message: "lib must not import an entry point." },
            ],
          },
        ],
      },
    },
    {
      files: ["src/lib/shared/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "#index.ts",
                  "#redis.ts",
                  "#lib/algorithms/**",
                  "#lib/store/**",
                  "#lib/memory/**",
                  "#lib/redis/**",
                  "#lib/limiter/**",
                ],
                message: "shared must not import other lib folders.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["src/lib/algorithms/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "#index.ts",
                  "#redis.ts",
                  "#lib/store/**",
                  "#lib/memory/**",
                  "#lib/redis/**",
                  "#lib/limiter/**",
                ],
                message: "algorithms may import only shared.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["src/lib/store/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "#index.ts",
                  "#redis.ts",
                  "#lib/memory/**",
                  "#lib/redis/**",
                  "#lib/limiter/**",
                ],
                message: "The store contract must not depend on a store or on limiters.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["src/lib/memory/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["#index.ts", "#redis.ts", "#lib/redis/**", "#lib/limiter/**"],
                message: "A store must not import another store or limiters.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["src/lib/redis/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["#index.ts", "#redis.ts", "#lib/memory/**", "#lib/limiter/**"],
                message: "A store must not import another store or limiters.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["src/lib/limiter/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["#index.ts", "#redis.ts", "#lib/memory/**", "#lib/redis/**"],
                message: "Limiters know only the store contract, not a concrete store.",
              },
            ],
          },
        ],
      },
    },
    {
      // JSDoc is the only type syntax available in plain JavaScript files.
      files: ["scripts/**/*.mjs"],
      rules: { "jsdoc/check-tag-names": ["error", { typed: false }] },
    },
  ],
  rules: {
    // Also report cycles that pass through type-only imports.
    "import/no-cycle": ["error", { ignoreTypes: false }],
  },
})
