// Hockey Operations Directory page (route: `/directory`).
//
// Data comes from the `getDirectoryEntries` server function in
// `app/server/directory.ts`. This file must NOT import
// `app/lib/supabase.server.ts` or read any secret env var Ã¢â‚¬â€ calling the server
// function is what keeps the service-role key on the server. The browser sends
// filter values and receives finished rows.
//
// The loader runs on the server for first paint and in the browser on
// client-side navigation; in both cases the server function itself executes
// server-side, so the credential never crosses.
//
// Result shape and error codes: `docs/server-function-contract.md`.

import { getRouteApi } from '@tanstack/react-router'

import { getDirectoryEntries } from '../server/directory'

/**
 * Loader for `/directory`. Calls the server function Ã¢â‚¬â€ no Supabase client and
 * no credential is involved on this side of the boundary.
 *
 * Registered by `src/routes/directory.tsx`, which is where TanStack Router's
 * generator scans for route files.
 */
export const directoryLoader = () => getDirectoryEntries({ data: {} })

const route = getRouteApi('/directory')

/** Friendly text per error code. The raw cause never reaches the browser. */
const ERROR_MESSAGE: Record<string, string> = {
  VALIDATION: 'That directory filter was not valid. Try clearing it.',
  UPSTREAM: 'The directory is temporarily unavailable. Try again in a moment.',
  UNKNOWN: 'Something went wrong loading the directory.',
}

export function DirectoryPage() {
  const result = route.useLoaderData()

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Directory</h1>
      <p className="mt-2 text-slate-600">
        Players and staff, loaded from the operations database through a server
        function. Credentials stay on the server.
      </p>

      {!result.ok ? (
        // Error state: a plain sentence, never a stack trace or raw error.
        <div
          role="alert"
          className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {ERROR_MESSAGE[result.error.code] ?? ERROR_MESSAGE.UNKNOWN}
        </div>
      ) : result.entries.length === 0 ? (
        // Empty is a success, not a failure Ã¢â‚¬â€ see the contract.
        <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-slate-600">
          No directory entries yet.
        </p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200">
            {result.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-slate-900">
                  {entry.jerseyNumber !== null ? (
                    <span className="mr-2 text-slate-500">#{entry.jerseyNumber}</span>
                  ) : null}
                  {entry.displayName}
                </span>
                <span className="text-sm text-slate-600">
                  {entry.positionOrTitle ?? (entry.role === 'staff' ? 'Staff' : 'Player')}
                  {entry.teamName ? ` Ã‚Â· ${entry.teamName}` : ''}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-sm text-slate-500">
            {result.meta.count} {result.meta.count === 1 ? 'entry' : 'entries'}
          </p>
        </>
      )}
    </section>
  )
}
