'use client'
import Image from 'next/image'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
export function MfaForm() {
  const router = useRouter()
  const [factor, setFactor] = useState('')
  const [qr, setQr] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  function begin() { startTransition(async () => {
    setError('')
    const supabase = createClient()
    const { data, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) { setError('認証情報を取得できません'); return }
    const existing = data.totp.find(item => item.status === 'verified')
    if (existing) { setFactor(existing.id); return }
    const { data: enrollment, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `TCG ROYAL ${Date.now()}` })
    if (enrollError) { setError('認証アプリを登録できません。管理者にお問い合わせください'); return }
    setFactor(enrollment.id); setQr(enrollment.totp.qr_code)
  }) }
  function verify(event: React.FormEvent) { event.preventDefault(); startTransition(async () => {
    setError('')
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: factor, code })
    if (error) { setError('認証コードを確認してください'); return }
    setQr(''); setCode(''); router.replace('/admin'); router.refresh()
  }) }
  return <div className="space-y-5">
    <p>認証アプリの6桁のコードを入力してください。初回は認証アプリを登録します。</p>
    {!factor && <button onClick={begin} disabled={pending} className="rounded bg-yellow-500 p-3 text-black">認証を開始</button>}
    {qr && <Image unoptimized src={qr} alt="認証アプリ登録用QRコード" width={240} height={240} />}
    {factor && <form onSubmit={verify} className="space-y-4"><label className="block">認証コード<input value={code} onChange={e => setCode(e.target.value)} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required className="mt-2 block rounded border border-[#777777] bg-[#ffffff] p-3 text-[#111111]" /></label><button disabled={pending} className="rounded bg-yellow-500 p-3 text-black">確認して管理画面へ</button></form>}
    {error && <p role="alert" className="text-red-500">{error}</p>}
  </div>
}
