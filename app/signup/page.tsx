import { redirect } from 'next/navigation'

function safeNextPath(value: string | string[] | undefined) {
  if (Array.isArray(value)) return ''
  if (!value || !value.startsWith('/') || value.startsWith('//')) return ''

  const pathname = value.split('?')[0]
  if (pathname === '/login' || pathname === '/register') return ''

  return value
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const next = safeNextPath((await searchParams).next)
  redirect(next ? `/register?next=${encodeURIComponent(next)}` : '/register')
}
