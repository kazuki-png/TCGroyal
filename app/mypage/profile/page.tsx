import { redirect } from 'next/navigation'
import {
  ProfileEditForm,
  type ProfileEditInitialData,
} from '@/components/auth/ProfileEditForm'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

function joinName(primary: string | null | undefined, secondary: string | null | undefined) {
  return [primary, secondary].filter(Boolean).join(' ').trim()
}

function birthdayParts(birthday: string | null | undefined) {
  const [year = '', month = '', day = ''] = String(birthday ?? '').split('-')
  return {
    year,
    month: month ? String(Number(month)) : '',
    day: day ? String(Number(day)) : '',
  }
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const p = profile as Profile | null
  const birthday = birthdayParts(p?.birthday)

  const initialData: ProfileEditInitialData = {
    email: user.email ?? '',
    lastName: joinName(p?.last_name, p?.first_name),
    lastNameKana: joinName(p?.last_name_kana, p?.first_name_kana),
    birthdayYear: birthday.year,
    birthdayMonth: birthday.month,
    birthdayDay: birthday.day,
    gender: p?.gender ?? '',
    occupation: p?.occupation ?? '',
    isQualifiedInvoice: Boolean(p?.is_qualified_invoice),
    idType: p?.id_type ?? '',
    hasIdentityImage: Boolean(p?.id_image_url),
    identityVerified: Boolean(p?.identity_verified),
    postalCode: p?.postal_code ?? '',
    address: p?.address ?? '',
    phone: p?.phone ?? '',
    bankName: p?.bank_name ?? '',
    branchName: p?.branch_name ?? '',
    accountType: p?.account_type ?? '',
    accountNumber: p?.account_number ?? '',
    accountHolderKana: p?.account_holder_kana ?? '',
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#2d2a20] bg-[#12100c] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c9a52e]">
          Profile
        </p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#f6f0dc] sm:text-3xl">
              会員情報
            </h1>
            <p className="mt-2 text-sm font-semibold text-[#8f8369]">
              登録情報、身分証、連絡先、振込先を編集できます。
            </p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-4 py-2 text-xs font-black ${
              p?.identity_verified
                ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/30'
                : 'bg-red-400/15 text-red-300 ring-1 ring-red-300/30'
            }`}
          >
            {p?.identity_verified ? '本人確認済み' : '本人確認 未確認'}
          </span>
        </div>
      </section>

      <ProfileEditForm initialData={initialData} />
    </div>
  )
}
