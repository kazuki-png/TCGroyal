import { SiteFooter } from '@/app/components/SiteFooter'
import { SiteHeader } from '@/app/components/SiteHeader'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata = {
  title: 'TCG Royal',
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader isAuthenticated={false} priorityLogo />
      <main className="flex-1 px-0 py-0 md:px-6 md:py-8">
        <div className="mx-auto w-full max-w-md md:max-w-5xl">
          <RegisterForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
