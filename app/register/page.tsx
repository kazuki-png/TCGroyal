import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata = {
  title: '新規登録 - TCG Royal',
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-white hover:text-zinc-300 transition-colors"
          >
            TCG Royal
          </Link>
          <p className="mt-2 text-zinc-400">新規アカウント登録</p>
        </div>

        <RegisterForm />

        <p className="mt-8 text-center text-xs text-zinc-600">
          © 2025 TCG Royal
        </p>
      </div>
    </div>
  )
}
