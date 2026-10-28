/** QR input is an identifier, never proof of authenticity or ownership. */
export function parsePsaCert(input: string): string | null {
  const value = input.trim()
  if (/^\d{6,12}$/.test(value)) return value
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !['psacard.com', 'www.psacard.com'].includes(url.hostname)
      || url.username || url.password || url.port) return null
    return url.pathname.match(/^\/cert\/(\d{6,12})(?:\/psa)?\/?$/i)?.[1] ?? null
  } catch { return null }
}
