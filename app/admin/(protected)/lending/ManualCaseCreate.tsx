'use client'
import Link from 'next/link'
import {useRef,useState,type FormEvent} from 'react'
import {useRouter} from 'next/navigation'
const field='mt-2 block w-full rounded-lg border border-white/15 bg-black px-3 py-3 text-sm text-white'
export function ManualCaseCreate(){
 const router=useRouter(),retry=useRef<{signature:string;key:string}|null>(null),lock=useRef(false)
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');const f=new FormData(event.currentTarget)
  const body={kind:'case',action:'create',consent:true,draft:{reason:f.get('reason'),cardName:f.get('cardName'),cardNumber:f.get('cardNumber'),condition:f.get('condition'),requestedAmount:f.get('amount'),notes:f.get('notes')},...(f.get('userId')?{userId:f.get('userId')}:{}),contactLabel:f.get('contactLabel')},signature=JSON.stringify(body)
  if(retry.current?.signature!==signature)retry.current={signature,key:crypto.randomUUID()}
  try{const r=await fetch('/api/admin/lending',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,key:retry.current.key})}),d=await r.json();if(!r.ok)throw Error(d.error??'登録できません。');router.push(`/admin/lending/case/${d.case.id}`);router.refresh()}catch(e){setError(e instanceof Error?e.message:'登録できません。');lock.current=false;setBusy(false)}
 }
 return <div className="mx-auto max-w-2xl space-y-6 text-zinc-100"><Link href="/admin/lending" className="text-sm text-amber-200 underline">← 融資管理へ戻る</Link><h1 className="text-2xl font-bold">相談・見積もりを手動登録</h1><p className="text-sm leading-7 text-zinc-400">LINE・店頭などで受け付けた案件を登録します。会員IDが不明な場合は空欄で受付し、後から本人と照合して紐付けできます。</p>{error&&<p role="alert" className="text-red-300">{error}</p>}
  <form onSubmit={submit}><fieldset disabled={busy} className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900 p-6">
   <label className="block text-sm">会員ID（任意）<input name="userId" className={field} maxLength={36}/></label><label className="block text-sm">LINE表示名などの照合メモ（管理者のみ）<input name="contactLabel" className={field} maxLength={100}/></label>
   <label className="block text-sm">相談の種類<select name="reason" className={field}><option value="ungraded">未鑑定</option><option value="no_certificate">PSA番号なし・不明</option><option value="other">その他</option></select></label>
   <label className="block text-sm">カード名<input name="cardName" required maxLength={100} className={field}/></label><label className="block text-sm">収録セット・カード番号<input name="cardNumber" maxLength={100} className={field}/></label><label className="block text-sm">状態・鑑定情報<input name="condition" maxLength={300} className={field}/></label><label className="block text-sm">借入希望額・円（任意）<input name="amount" type="number" min={1} max={10000000} step={1} className={field}/></label><label className="block text-sm">利用者と共有する相談内容<textarea name="notes" maxLength={1000} className={field}/></label>
   <label className="flex gap-3 text-sm"><input type="checkbox" required/>内容を確認して案件として記録します。見積もりへの同意・融資申込は利用者が別途行います。</label><button className="rounded-xl bg-amber-200 px-5 py-3 font-bold text-black disabled:opacity-40">{busy?'登録中…':'相談案件を登録'}</button>
  </fieldset></form>
 </div>
}
