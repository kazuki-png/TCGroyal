export function escapeCsvCell(value: string | number | null | undefined) {
  let text = value == null ? '' : String(value)
  if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
