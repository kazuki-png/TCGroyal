'use client'
import Link from 'next/link'
import {useEffect,useRef,useState} from 'react'
import type {AdminLendingDetail} from '@/lib/lending/admin-types'
import {SUPPORT_CASE_STATUS} from '@/lib/lending/support-case-types'
import {CaseAction,CatalogEvidence} from '@/app/lending/SupportCaseManager'
import {LoanCard} from '@/app/lending/LendingWorkspace'
const yen=(amount:number)=>`¥${amount.toLocaleString('ja-JP')}`
const date=(value:string|null)=>value?new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'—'
export function LendingDetail({kind,id}:{kind:'case'|'loan';id:string}){
 const [data,setData]=useState<AdminLendingDetail|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const retries=useRef(new Map<string,string>()),lock=useRef(false)
 const path=`/api/admin/lending?kind=${kind}&id=${id}`
 useEffect(()=>{const controller=new AbortController();void fetch(path,{signal:controller.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error??'案件を取得できません。');setData(d)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[path])
 async function load(){const r=await fetch(path,{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error??'案件を取得できません。');setData(d)}
 async function send(body:Record<string,unknown>){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');const signature=JSON.stringify({kind,...body}),key=retries.current.get(signature)??crypto.randomUUID();retries.current.set(signature,key)
  try{const r=await fetch('/api/admin/lending',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,...body,key})}),d=await r.json();if(!r.ok)throw Error(d.error??'保存できません。');retries.current.delete(signature);setNotice('手続きを記録しました。');await load()}catch(e){setError(e instanceof Error?e.message:'操作できません。')}finally{lock.current=false;setBusy(false)}
 }
 return <div className="mx-auto max-w-4xl space-y-6 text-zinc-100">
  <div className="flex items-center justify-between gap-4"><Link href="/admin/lending" className="text-sm text-amber-200 underline">← 融資管理へ戻る</Link><button disabled={busy} className="rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-40" onClick={()=>void load().catch(e=>setError(e.message))}>再読み込み</button></div>
  <h1 className="text-2xl font-bold">{kind==='case'?'査定・見積もりの詳細':'申込・契約の詳細'}</h1>
  {error&&<p role="alert" className="rounded-xl bg-red-950/40 p-4 text-red-200">{error}</p>}{notice&&<p role="status" className="text-emerald-200">{notice}</p>}
  {!data&&!error&&<p role="status" className="text-zinc-400">案件を読み込んでいます…</p>}
  {data&&<>
   <section className="rounded-2xl border border-white/10 bg-zinc-900 p-5"><h2 className="font-bold">利用者</h2><p className="mt-3">{data.customer?.name||(data.customer?'氏名未登録':'会員未紐付け')}</p><p className="mt-2 text-sm text-zinc-400">会員ID {data.customer?.id??'未登録'} / 電話番号 {data.customer?.phone??'未登録'}</p><p className="mt-2 text-sm">融資用の本人確認：{data.customer?.identityVerified?'有効':'未完了・期限切れ'}</p></section>
   {data.kind==='case'?<section className="space-y-4 rounded-2xl border border-white/10 bg-[#111b2d] p-6">
    <div className="flex flex-wrap justify-between gap-3"><p className="font-mono text-amber-200">{data.item.reference}</p><span>{SUPPORT_CASE_STATUS[data.item.status]}</span></div><h2 className="text-xl font-bold">{data.item.card_name}</h2><p>{data.item.card_number} / {data.item.condition}</p><CatalogEvidence item={data.item}/><p className="whitespace-pre-wrap text-sm text-zinc-300">{data.item.notes||'相談内容の追記なし'}</p><p className="text-xs text-zinc-400">管理者用照合メモ：{data.item.contact_label||'未登録'}</p>
    <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-zinc-400">借入希望額</dt><dd className="mt-2">{data.item.requested_jpy===null?'未登録':yen(data.item.requested_jpy)}</dd></div><div><dt className="text-zinc-400">運営の見積もり</dt><dd className="mt-2">{data.item.offer_jpy===null?'未提示':yen(data.item.offer_jpy)}</dd></div><div><dt className="text-zinc-400">評価額</dt><dd className="mt-2">{data.item.valuation_jpy===null?'未登録':yen(data.item.valuation_jpy)}</dd></div><div><dt className="text-zinc-400">見積もりの期限</dt><dd className="mt-2">{date(data.item.offer_expires_at)}</dd></div></dl>{data.item.offer_note&&<p className="text-sm">見積もり根拠：{data.item.offer_note}</p>}
    {data.item.loan_id?<Link href={`/admin/lending/loan/${data.item.loan_id}`} className="inline-block rounded-lg bg-amber-200 px-4 py-3 font-bold text-black">引き継いだ申込・契約を開く</Link>:<CaseAction key={data.item.version} item={data.item} busy={busy} send={send}/>}
    <h3 className="border-t border-white/10 pt-4 font-bold">対応履歴</h3>{data.item.events?.map(e=><p key={e.id} className="text-xs leading-6 text-zinc-400">{date(e.created_at)} / {SUPPORT_CASE_STATUS[e.to_status]} / {e.message}</p>)}
   </section>:<>
    {data.item.support_case&&<section className="space-y-2 rounded-xl border border-white/10 p-5 text-sm"><Link href={`/admin/lending/case/${data.item.support_case.id}`} className="text-amber-200 underline">受付 {data.item.support_case.reference} の査定履歴</Link><p>{data.item.support_case.condition}</p><p className="whitespace-pre-wrap text-zinc-400">{data.item.support_case.notes}</p></section>}
    {data.item.valuation_source!=='support'&&['received','offered','accepted'].includes(data.item.status)&&<p className="rounded-lg bg-amber-200/10 p-4 text-sm text-amber-100">旧方式で査定された申込です。条件を変更する場合は、個別見積もりとして再受付してください。外部価格の連携は行いません。</p>}
    <LoanCard key={data.item.version} loan={data.item} admin allowOffer={data.item.valuation_source==='support'} send={async body=>{await send(body)}} busy={busy}/>
   </>}
  </>}
 </div>
}
