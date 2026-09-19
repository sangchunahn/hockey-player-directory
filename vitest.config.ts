// Vitest configuration.
//
// Deliberately standalone — it does NOT extend `vite.config.ts`. The app's Vite
// config loads the TanStack Start, Nitro, React and Tailwind plugins, none of
// which a pure-function unit test needs. Keeping this config small also keeps
// the test boot boring and secret-free: nothing here imports
// `app/lib/supabase.server.ts`, reads `serverEnv`, or loads a `.env` file, and
// nothing here should. Unit tests for pure mappers must not need database
// credentials — if a test ever seems to, the code under test is doing I/O and
// belongs on the other side of the split (see
// `docs/server-function-contract.md`).
import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

// `import.meta.dirname` rather than `__dirname`: Vite warns that `__dirname` is
// unsupported by the native config loader that becomes the default in a future
// major version of Vite.
const rootDir = import.meta.dirname

export default defineConfig({
  test: {
    // Pure TypeScript helpers, not React components — no DOM needed.
    // Switch to 'jsdom' per-file (`// @vitest-environment jsdom`) if a
    // component test is ever added, rather than slowing every test down.
    environment: 'node',

    include: ['app/**/*.test.ts', 'src/**/*.test.ts'],

    // TODO: remove once the mapper tests land in the next step. It exists only
    // so `npm test` reports success while there are genuinely zero tests; left
    // in place afterwards it would let CI pass when tests silently stop being
    // discovered.
    passWithNoTests: true,
  },

  resolve: {
    // Mirrors the app's import aliases so a test imports a module by exactly
    // the same specifier the app uses. `#app/` must come before `#/`, since
    // these are matched as prefixes in order.
    alias: [
      { find: '#app/', replacement: resolve(rootDir, 'app') + '/' },
      { find: '#/', replacement: resolve(rootDir, 'src') + '/' },
      { find: '@/', replacement: resolve(rootDir, 'src') + '/' },
    ],
  },
})
