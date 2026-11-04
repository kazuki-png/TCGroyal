'use client'
import {useEffect,useState} from 'react'
import type {BankPaymentPreview} from '@/lib/lending/bank-payment-types'
import type {WorkflowLoan} from '@/lib/lending/workflow-types'
export function BankSettlementFields({loan,extension}:{loan:WorkflowLoan;extension:boolean}){
 const [paidAt,setPaidAt]=useState(''),[quote,setQuote]=useState<BankPaymentPreview|null>(null),[error,setError]=useState('')
 useEffect(()=>{
  if(!paidAt)return
  const controller=new AbortController()
  void fetch(`/api/admin/lending?view=payment&id=${loan.id}&date=${paidAt.slice(0,10)}`,{signal:controller.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error??'金額を確認できません。');setQuote(d.preview);setError('')}).catch(e=>{if(!controller.signal.aborted){setQuote(null);setError(e.message)}})
  return()=>controller.abort()
 },[loan.id,paidAt])
 return <div className="space-y-2 rounded-xl border border-amber-300/20 p-3 text-sm">
  {loan.bank_payment_report&&<p>申告：{loan.bank_payment_report.transferDate} / {loan.bank_payment_report.transferName}</p>}
  {extension&&loan.requests.filter(r=>r.kind==='extension'&&r.status==='pending').map(r=><p key={r.id}>延長申告：{String(r.consent_terms.transferDate??'—')} / {String(r.consent_terms.transferName??'—')}</p>)}
  <label className="block">銀行で確認した着金日時（日本時間）<input name="paidAt" type="datetime-local" value={paidAt} onChange={e=>{setPaidAt(e.target.value);setQuote(null)}} required className="mt-2 w-full rounded-lg bg-black p-3 text-white"/></label>
  {quote&&<p className="text-amber-200">着金日の必要額：¥{(extension?quote.extensionAmountJpy:quote.totalJpy).toLocaleString('ja-JP')}{extension?'（質料）':`（元金＋${quote.chargeLabel}）`}</p>}
  {error&&<p role="alert" className="text-red-300">{error}</p>}
  {extension&&<p className="text-zinc-400">申告・着金が満期日23:59までなら、管理者の確認は翌日以降でも可能です。</p>}
 </div>
}
