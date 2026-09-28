
import { safeLocalPath } from '@/lib/security/redirect'
import { redirect } from 'next/navigation'

const safeNextPath = (value: unknown) => safeLocalPath(value, "/mypage")

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const next = safeNextPath((await searchParams).next)
  redirect(next ? `/register?next=${encodeURIComponent(next)}` : '/register')
}
