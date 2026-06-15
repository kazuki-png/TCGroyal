import { SiteFooter } from '@/app/components/SiteFooter'
import { SiteHeader } from '@/app/components/SiteHeader'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata = {
  title: 'TCG ROYAL',
}

function safeNextPath(value: string | string[] | undefined) {
  if (Array.isArray(value)) return ''
  if (!value || !value.startsWith('/') || value.startsWith('//')) return ''

  const pathname = value.split('?')[0]
  if (pathname === '/login' || pathname === '/register') return ''

  return value
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const nextPath = safeNextPath((await searchParams).next)

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0a08] text-[#ede8d5]">
      <SiteHeader
        isAuthenticated={false}
        priorityLogo
        breadcrumbs={[
          { href: '/', label: 'トップ' },
          { label: '新規登録' },
        ]}
      />
      <main className="flex-1 px-0 py-0 md:px-6 md:py-8">
        <div className="mx-auto w-full max-w-md md:max-w-5xl">
          <RegisterForm nextPath={nextPath} />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
