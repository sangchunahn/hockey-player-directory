// Route registration for `/directory`.
//
// TanStack Router's generator only scans `src/routes`, and it needs to see the
// `createFileRoute` call here (a re-export is not recognized). So this file is
// the registration point and nothing else: the loader, the component and every
// design decision live in `app/routes/directory.tsx`, alongside `app/config`,
// `app/lib` and `app/server`.
import { createFileRoute } from '@tanstack/react-router'

import { DirectoryPage, directoryLoader } from '../../app/routes/directory'

export const Route = createFileRoute('/directory')({
  loader: directoryLoader,
  component: DirectoryPage,
})