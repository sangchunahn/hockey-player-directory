// Environment variable access — the ONE place this app reads env vars.
//
// Two exports, deliberately separate:
//
//   publicEnv  — values Vite embeds in the browser bundle (VITE_ prefix).
//                Safe to import anywhere, including route components.
//   serverEnv  — secrets. Server-only. See the warning above it below.
//
// They are separate objects, not one `env`, so that client code cannot reach a
// secret by autocompleting through a shared object. Names and the public/secret
// split come from `docs/client-vs-server-inventory.md`; the file contract for
// teammates is `.env.example`.
//
// Reads are LAZY (getters). Importing this module never throws — a missing
// variable fails at the moment something actually needs it, with a message that
// says which name is missing and where to set it. That keeps the app bootable
// before Supabase is wired up in a later step.

/** Where a teammate should go when a variable turns out to be missing. */
const SETUP_HINT =
  'Copy .env.example to .env.local, fill it from Supabase → Settings → API, ' +
  'then restart the dev server (Vite reads env files at startup). ' +
  'In production, set it in the Vercel dashboard → Settings → Environment Variables.'

/**
 * Read a browser-exposed value. Present on both sides: Vite inlines `VITE_*`
 * into the client bundle, and it is also available during SSR.
 */
function readPublicVar(name: `VITE_${string}`): string {
  const value = import.meta.env[name]

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required public env var ${name}. ${SETUP_HINT}`)
  }

  return value
}

/**
 * Read a server-only secret.
 *
 * Guards twice, because the cost of a miss is a leaked master key:
 *  1. Refuses to run in a browser at all. If this throws, some module in the
 *     client bundle graph imported `serverEnv` — fix the import, do not
 *     "handle" the error.
 *  2. Refuses to return an empty value, so a missing secret surfaces here
 *     instead of as a confusing Supabase auth failure three layers down.
 */
function readSecretVar(name: string): string {
  if (typeof window !== 'undefined') {
    throw new Error(
      `Refusing to read the server-only env var ${name} in the browser. ` +
        'Something in the client bundle imported `serverEnv`. Move that code ' +
        'behind a server function and import `publicEnv` here instead. ' +
        'See docs/client-vs-server-inventory.md.',
    )
  }

  const value = process.env[name]

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required server env var ${name}. ${SETUP_HINT}`)
  }

  return value
}

/**
 * Public configuration — assume every value here is visible to anyone who opens
 * DevTools. Safe to import from routes and components.
 *
 * The anon key is publishable by design; what protects the data is Row Level
 * Security on the database (Sprint 4), not secrecy of this key.
 */
export const publicEnv = {
  get SUPABASE_URL(): string {
    return readPublicVar('VITE_SUPABASE_URL')
  },
  get SUPABASE_ANON_KEY(): string {
    return readPublicVar('VITE_SUPABASE_ANON_KEY')
  },
}

/**
 * ⚠️ SERVER ONLY — DO NOT IMPORT FROM CLIENT CODE. ⚠️
 *
 * Never import this from `src/routes/**` component code, `src/components/**`,
 * or any module those import. Whatever a route file imports, Vite bundles and
 * ships to the browser.
 *
 * Note that a TanStack Start route `loader` runs on the server for first paint
 * AND in the browser on client-side navigation — so "it's in a loader" is not
 * enough. Secrets belong behind a server function.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security entirely. Leaking it
 * is a full database compromise, so rotate it (Settings → API → Reset) rather
 * than assuming a leak was harmless.
 *
 * Safe places to import this: server functions, and server-only modules named
 * `*.server.ts`.
 */
export const serverEnv = {
  get SUPABASE_URL(): string {
    return readSecretVar('SUPABASE_URL')
  },
  get SUPABASE_SERVICE_ROLE_KEY(): string {
    return readSecretVar('SUPABASE_SERVICE_ROLE_KEY')
  },
}
