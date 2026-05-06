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
    <div className="mx-auto w-full max-w-md bg-white px-3 pb-10 pt-2 text-zinc-950 md:max-w-5xl md:px-6 md:pb-8 md:pt-4">
      <h1 className="mb-7 text-center text-xl font-black text-zinc-950">会員情報</h1>
      <ProfileEditForm initialData={initialData} />
    </div>
  )
}
