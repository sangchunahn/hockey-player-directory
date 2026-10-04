// Root route — the top-level layout for every page in the app.
//
// Two pieces here:
//   * shellComponent (RootDocument) renders the HTML document (<html>/<head>/<body>).
//   * component (RootLayout) renders the shared VISIBLE shell: a "Hockey Ops
//     Directory" header, a placeholder for primary navigation, and an <Outlet />
//     where each page (/, /players, /players/$playerId, /games) is shown.
//
// Keep this file a SHELL only. No player or games data, tables, or fetching
// live here — those belong in the individual route files (later steps).
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { AppNav } from '../components/AppNav'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Hockey Ops Player Directory',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

// Shared chrome for the whole directory. Child routes render through <Outlet />.
//
// QueryClientProvider holds the TanStack Query cache used by
// src/lib/scouting/hooks.ts and mutation-hooks.ts. It is created once per mount
// with useState, so each server render gets its own cache (no data shared
// between visitors) and the browser keeps one cache for the session.
function RootLayout() {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 px-6 py-4">
        <p className="text-lg font-semibold">Hockey Ops Directory</p>
      </header>

      {/* Shared, type-safe primary nav — renders on every page. */}
      <AppNav />

      <main className="flex-1 px-6 py-6">
        <Outlet />
      </main>
    </div>
    </QueryClientProvider>
  )
}

// The HTML document shell. `children` is the router tree (RootLayout + pages).
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
