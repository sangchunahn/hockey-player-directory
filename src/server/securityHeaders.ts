// This module DEFINES headers. It does not attach them to responses.
// See docs/security/security-headers-notes.md for why each one exists and
// what a wrong value would break. Source of the threat list:
// docs/security/attack-surface-map.md.

export type SecurityHeader = { name: string; value: string }

/** One CSP directive per line so a reviewer can explain each rule. */
export const contentSecurityPolicyDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  'upgrade-insecure-requests',
] as const

export const contentSecurityPolicy = contentSecurityPolicyDirectives.join('; ')

export const securityHeaders: readonly SecurityHeader[] = [
  { name: 'Content-Security-Policy', value: contentSecurityPolicy },
  { name: 'X-Content-Type-Options', value: 'nosniff' },
  { name: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { name: 'X-Frame-Options', value: 'DENY' },
  { name: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // No preload. No includeSubDomains. 180 days is enough to define the intent.
  { name: 'Strict-Transport-Security', value: 'max-age=15552000' },
  { name: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

export function securityHeadersAsRecord(): Record<string, string> {
  return Object.fromEntries(securityHeaders.map((header) => [header.name, header.value]))
}
