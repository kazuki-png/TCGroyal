import {LOAN_STATUS_LABELS,type LoanStatus} from '@/lib/lending/workflow-types'
import {SUPPORT_CASE_STATUS,type SupportCaseStatus} from '@/lib/lending/support-case-types'
export function StatusProgress({kind,status}:{kind:'case'|'loan';status:string}){
 const flow=kind==='case'?['registered','reviewing','offered','applied']:['submitted','received','offered','accepted','active','repayment_pending','return_pending','returned']
 const labels=kind==='case'?SUPPORT_CASE_STATUS:LOAN_STATUS_LABELS
 const title=kind==='case'?SUPPORT_CASE_STATUS[status as SupportCaseStatus]:LOAN_STATUS_LABELS[status as LoanStatus]
 const index=flow.indexOf(status)
 return <section aria-label="現在のステータス" className="space-y-4 rounded-2xl border border-amber-200/20 bg-amber-200/[.04] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">現在のステータス</h2><span className="rounded-full bg-amber-200 px-4 py-2 text-sm font-bold text-black">{title}</span></div><ol className="flex flex-wrap gap-2">{flow.map((value,i)=><li key={value} aria-current={value===status?'step':undefined} className={`rounded-lg border px-3 py-2 text-xs ${i===index?'border-amber-200 text-amber-200':index>=0&&i<index?'border-white/20 text-zinc-200':'border-white/5 text-zinc-600'}`}>{i+1}. {labels[value as keyof typeof labels]}</li>)}</ol>{kind==='loan'&&<p className="text-xs leading-6 text-zinc-400">変更先は下の「変更先ステータス・手続き」から選びます。検品・条件同意・出金・入金の確認を伴うため、任意の段階への飛ばし更新や、残高を変える単純な巻き戻しは行いません。</p>}</section>
}
