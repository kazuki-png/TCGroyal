'use client'
import {useState,type FormEvent} from 'react'
import {SUPPORT_CASE_STATUS,type SupportCase} from '@/lib/lending/support-case-types'
export function RevertCaseStatus({item,busy,send}:{item:SupportCase;busy:boolean;send:(body:Record<string,unknown>)=>Promise<unknown>}){
 const [reason,setReason]=useState(''),[selected,setSelected]=useState('')
 const targets=item.loan_id?[]:item.status==='reviewing'?['registered']:item.status==='information_required'?['registered','reviewing']:item.status==='offered'?['reviewing']:[]
 if(!targets.length)return null
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!reason.trim())return;if(!window.confirm('ステータスを戻し、提示済みの見積もりを無効にします。よろしいですか？'))return;await send({action:'rollback',caseId:item.id,status:targets.includes(selected)?selected:targets[0],reason,version:item.version})}
 return <details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer text-sm text-zinc-300">ステータスを戻す</summary><form onSubmit={submit}><fieldset disabled={busy} className="mt-4 space-y-4"><p className="text-xs leading-6 text-zinc-400">申込に進む前の査定案件だけ戻せます。提示済みの金額と有効期限を解除し、理由を利用者の履歴に記録して通知します。</p><label className="block text-sm">戻し先ステータス<select className="mt-2 block w-full rounded-lg border border-white/15 bg-black p-3" value={targets.includes(selected)?selected:targets[0]} onChange={e=>setSelected(e.target.value)}>{targets.map(value=><option key={value} value={value}>{SUPPORT_CASE_STATUS[value as keyof typeof SUPPORT_CASE_STATUS]}</option>)}</select></label><label className="block text-sm">戻す理由<textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 block w-full rounded-lg border border-white/15 bg-black p-3"/></label><button disabled={!reason.trim()} className="rounded-lg border border-amber-200/40 px-4 py-3 text-sm font-bold text-amber-200 disabled:opacity-40">理由を記録してステータスを戻す</button></fieldset></form></details>
}
