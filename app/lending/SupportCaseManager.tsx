'use client'
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react'
import {SUPPORT_CASE_STATUS,type SupportCase,type SupportCaseList} from '@/lib/lending/support-case-types'
import {LOAN_STATUS_LABELS} from '@/lib/lending/workflow-types'
const input='mt-1 w-full rounded-lg border border-white/15 bg-[#0a1220] p-3 text-sm text-white'
const button='rounded-lg bg-amber-200 px-4 py-3 text-sm font-bold text-zinc-950 disabled:opacity-40'
export function CatalogEvidence({item}:{item:SupportCase}){
 if(!item.card_uid)return null
 return <div className="space-y-1 rounded-lg border border-amber-200/20 p-3 text-xs text-zinc-300"><p>{item.search_method==='image'?'画像で候補検索':'カード一覧から選択'} / カードID {item.card_uid}</p><p>登録グレード {item.selected_card?.grade} / 利用者申告 {item.declared_grade} / PSA番号 {item.declared_cert_number??'未登録'}（公式未照会・現物確認待ち）</p>{item.indicative_jpy!=null&&<p>受付時の参考額 ¥{item.indicative_jpy.toLocaleString('ja-JP')}。管理者による見積もり提示とは別です。</p>}</div>
}
export function CaseAction({item,busy,send}:{item:SupportCase;busy:boolean;send:(body:Record<string,unknown>)=>Promise<unknown>}){
 const [action,setAction]=useState('review')
 const terminal=['applied','declined','cancelled'].includes(item.status)
 const options=[...(!item.user_id?['link']:[]),...(['registered','information_required','reviewing'].includes(item.status)?['review']:[]),'request_info',...(item.user_id&&['reviewing','information_required','offered'].includes(item.status)?['offer']:[]),'decline','cancel']
 const selected=options.includes(action)?action:options[0]
 if(terminal)return null
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);const payload:Record<string,unknown>={};
  if(selected==='link')payload.userId=form.get('userId');else payload.message=form.get('message')
  if(selected==='offer'){payload.amountJpy=Number(form.get('amount'));payload.valuationJpy=Number(form.get('valuation'))}
  await send({action:selected,caseId:item.id,version:item.version,payload})
 }
 return <form onSubmit={submit}><fieldset disabled={busy} className="space-y-3"><label className="block text-sm">変更先ステータス・手続き<select value={selected} onChange={e=>setAction(e.target.value)} className={input}>{options.map(value=><option key={value} value={value}>{({link:'会員を紐付ける',review:'査定中',request_info:'追加情報を依頼',offer:'見積もり提示（条件を入力）',decline:'見送り',cancel:'相談をキャンセル'} as Record<string,string>)[value]}</option>)}</select></label>
  {selected==='link'?<label className="block text-sm">本人と照合した会員ID（UUID）<input name="userId" required className={input} placeholder="会員のユーザーID"/></label>:<label className="block text-sm">利用者に表示する案内・見積もり根拠<textarea name="message" required maxLength={500} className={input}/></label>}
  {selected==='offer'&&<><label className="block text-sm">確認したカード評価額（円）<input name="valuation" type="number" min={1} max={1000000000} required className={input}/></label><label className="block text-sm">融資参考額（円）<input name="amount" type="number" min={100000} max={10000000} step={10000} required className={input}/></label><p className="text-xs text-zinc-400">24時間有効の見積もりです。申込は利用者がアプリで行い、現物検品後に最終条件へ改めて同意します。</p></>}
  <button className={button} type="submit">ステータス・手続きを更新</button></fieldset></form>
}
export function SupportCaseManager({role='admin',onChanged}:{role?:'admin'|'customer';onChanged?:()=>Promise<void>}){
 const [data,setData]=useState<SupportCaseList|null>(null),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const retries=useRef(new Map<string,string>())
 const load=useCallback(async(query='')=>{const response=await fetch(`/api/lending/support-cases?search=${encodeURIComponent(query)}`,{headers:{'x-lending-demo-role':role},cache:'no-store'});const value=await response.json();if(!response.ok)throw Error(value.error??'案件を取得できません。');setData(value)},[role])
 useEffect(()=>{let live=true;void fetch('/api/lending/support-cases',{headers:{'x-lending-demo-role':role},cache:'no-store'}).then(async response=>{const value=await response.json();if(!response.ok)throw Error(value.error);if(live)setData(value)}).catch(cause=>{if(live)setError(cause.message)});return()=>{live=false}},[role])
 async function send(body:Record<string,unknown>){if(busy)return;setBusy(true);setError('');setNotice('');const signature=JSON.stringify(body),key=retries.current.get(signature)??crypto.randomUUID();retries.current.set(signature,key)
  try{const response=await fetch('/api/lending/support-cases',{method:'POST',headers:{'Content-Type':'application/json','x-lending-demo-role':role},body:JSON.stringify({...body,key})});const value=await response.json();if(!response.ok)throw Error(value.error??'更新できません。');retries.current.delete(signature);setNotice(`保存しました。受付番号 ${value.case.reference}`);try{await load(search);await onChanged?.()}catch{setError('保存済みです。一覧を再読み込みしてください。')}return true}catch(cause){setError(cause instanceof Error?cause.message:'操作できません。');return false}finally{setBusy(false)}
 }
 async function create(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const f=new FormData(form);const saved=await send({action:'create',consent:true,draft:{reason:f.get('reason'),cardName:f.get('cardName'),cardNumber:f.get('cardNumber'),condition:f.get('condition'),requestedAmount:f.get('amount'),notes:f.get('notes')},...(f.get('userId')?{userId:f.get('userId')}:{}),contactLabel:f.get('contactLabel')});if(saved)form.reset()}
 return <section id="support-cases" className="space-y-5 rounded-2xl border border-white/10 bg-[#111b2d] p-5"><h2 className="text-xl font-bold">個別見積もり・LINE相談案件</h2><p className="text-sm text-zinc-400">LINEの受付番号で検索できます。LINEを開いた時点では連絡済みにはしません。実際の連絡と写真を確認して査定中へ進めてください。</p>
  {error&&<p role="alert" className="text-red-300">{error}</p>}{notice&&<p role="status" className="text-emerald-200">{notice}</p>}
  <form onSubmit={event=>{event.preventDefault();void load(search).catch(cause=>setError(cause.message))}} className="flex items-end gap-3"><label className="flex-1 text-sm">受付番号・カード名<input className={input} value={search} onChange={event=>setSearch(event.target.value)} maxLength={100}/></label><button disabled={busy} className={button}>検索・更新</button></form>
  <details><summary className="cursor-pointer text-amber-200">LINEからの相談を手動登録</summary><form onSubmit={create} className="mt-4"><fieldset disabled={busy} className="space-y-3">
   <label className="block text-sm">会員ID（未登録なら空欄）<input className={input} name="userId"/></label><label className="block text-sm">LINE表示名などの照合メモ（管理者のみ）<input className={input} name="contactLabel" maxLength={100}/></label>
   <label className="block text-sm">相談の種類<select className={input} name="reason"><option value="ungraded">未鑑定</option><option value="no_certificate">PSA番号なし・不明</option><option value="other">その他</option></select></label>
   <label className="block text-sm">カード名<input className={input} name="cardName" maxLength={100} required/></label><label className="block text-sm">収録セット・カード番号<input className={input} name="cardNumber" maxLength={100}/></label><label className="block text-sm">状態・鑑定情報<input className={input} name="condition" maxLength={300}/></label><label className="block text-sm">借入希望額（任意・円）<input className={input} name="amount" type="number" min={1} max={10000000}/></label><label className="block text-sm">利用者と共有する相談内容<textarea className={input} name="notes" maxLength={1000}/></label>
   <label className="flex gap-3 text-sm"><input type="checkbox" required/>相談内容を確認し、案件として記録します</label><button className={button}>相談案件を登録</button>
  </fieldset></form></details>
  {data?.cases.map(item=><article key={`${item.id}-${item.version}`} className="space-y-3 rounded-xl border border-white/10 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{item.reference} / {item.card_name}</p><p>{item.loan_status?LOAN_STATUS_LABELS[item.loan_status]:SUPPORT_CASE_STATUS[item.status]}{!item.user_id?'・会員紐付け待ち':''}</p></div><p className="text-xs text-zinc-400">会員ID: {item.user_id??'未登録'} / {item.contact_label||'照合メモなし'}</p><p className="text-sm">{item.card_number} / {item.condition}</p><CatalogEvidence item={item}/><p className="whitespace-pre-wrap text-sm">{item.notes}</p>{item.offer_jpy!==null&&<p className="text-amber-200">融資参考額 ¥{item.offer_jpy.toLocaleString('ja-JP')} / {item.offer_note}</p>}{item.loan_id?<p className="text-sm text-zinc-400">申込ID {item.loan_id}。検品・最終条件・入出金は下の申込・契約一覧で管理します。</p>:<CaseAction item={item} busy={busy} send={send}/>}<details><summary className="cursor-pointer text-xs text-zinc-400">更新履歴</summary>{item.events?.map(event=><p key={event.id} className="mt-2 text-xs">{new Date(event.created_at).toLocaleString('ja-JP')} / {SUPPORT_CASE_STATUS[event.to_status]} / {event.message}</p>)}</details></article>)}
  {data?.cases.length===0&&<p className="text-zinc-400">該当する相談案件はありません。</p>}{data&&<p className="text-xs text-zinc-400">全{data.total}件。新しい順に最大100件。受付番号で過去の案件も検索できます。</p>}
 </section>
}
