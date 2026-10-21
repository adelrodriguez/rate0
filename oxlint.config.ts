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
    //   options, expiring-map <- algorithms <- store <- stores/*
    //                                                <- limiter
    //
    // A folder imports its own files with `./` and other folders with `#lib/...`, so a rule can ban a
    // whole folder without banning a folder's own files. A limiter knows only the store contract,
    // never a concrete store, and a store knows nothing of other stores or of limiters. Tests may
    // cross these lines, so the rules cover source files only.
    {
      files: ["src/**/*.ts"],
      rules: {
        "import/no-relative-parent-imports": "error",
      },
    },
    {
      files: ["src/lib/options/*.ts", "src/lib/expiring-map/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["#index.ts", "#stores/**"],
                message: "lib must not import an entry point.",
              },
              {
                group: ["#lib/**"],
                message: "options and expiring-map import nothing else in lib.",
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
                group: ["#index.ts", "#stores/**"],
                message: "lib must not import an entry point.",
              },
              {
                group: ["#lib/**", "!#lib/options/**"],
                message: "algorithms import only options.",
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
                group: ["#index.ts", "#stores/**"],
                message: "lib must not import an entry point.",
              },
              {
                group: ["#lib/**", "!#lib/algorithms/**"],
                message: "The store contract imports only algorithms.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["src/lib/stores/*/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["#index.ts", "#stores/**"],
                message: "lib must not import an entry point.",
              },
              {
                group: ["#lib/stores/**", "#lib/limiter/**"],
                message:
                  "A store imports its own files with ./, and never another store or limiters.",
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
                group: ["#index.ts", "#stores/**"],
                message: "lib must not import an entry point.",
              },
              {
                group: ["#lib/stores/**"],
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
