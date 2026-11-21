// Server-side CSRF / origin gate for writes.
// Does not sign anyone in and must not import Supabase.
// Wired into src/routes/api/events.ts and src/routes/api/evaluations.ts,
// which call csrfBlockResponse before accepting a write.
// See docs/security/csrf-defense-notes.md and docs/security/attack-surface-map.md.

export type CsrfReason = 'cross-site' | 'origin-mismatch' | 'missing-origin' | 'allowlist-empty'

export type CsrfResult = { ok: true } | { ok: false; status: 403; reason: CsrfReason }

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function isStateChangingMethod(method: string): boolean {
  return STATE_CHANGING.has(method.toUpperCase())
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, '').toLowerCase()
}

/** Trusted public origins. Empty must NOT mean allow-all. */
export function readAllowedOrigins(): string[] {
  const raw = process.env.APP_ORIGIN ?? ''
  return raw
    .split(',')
    .map((part) => normalizeOrigin(part))
    .filter((part) => part.length > 0)
}

export function checkCsrf(request: Request, allowedOrigins: string[] = readAllowedOrigins()): CsrfResult {
  if (!isStateChangingMethod(request.method)) {
    return { ok: true }
  }

  if (allowedOrigins.length === 0) {
    return { ok: false, status: 403, reason: 'allowlist-empty' }
  }

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') {
    return { ok: false, status: 403, reason: 'cross-site' }
  }

  const originHeader = request.headers.get('origin')
  if (!originHeader) {
    return { ok: false, status: 403, reason: 'missing-origin' }
  }

  const origin = normalizeOrigin(originHeader)
  const allowed = new Set(allowedOrigins.map(normalizeOrigin))
  if (!allowed.has(origin)) {
    return { ok: false, status: 403, reason: 'origin-mismatch' }
  }

  return { ok: true }
}

/** null means the route may continue. A Response means stop with 403. */
export function csrfBlockResponse(request: Request): Response | null {
  const result = checkCsrf(request)
  if (result.ok) return null

  return new Response(JSON.stringify({ error: 'forbidden', reason: result.reason }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  })
}
