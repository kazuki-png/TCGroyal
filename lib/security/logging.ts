import 'server-only'
// Never serialize provider errors, SQL details, credentials, or customer payloads.
export function logSafeError(event: unknown, ..._details: unknown[]) {
  void _details
  const label = typeof event === 'string' && /^[a-zA-Z0-9 _:[\]()-]{1,120}$/.test(event) ? event : 'operation_failed'
  console.error('[application]', label)
}
