import {adminLendingAccess} from '@/lib/lending/admin-access'
import {createWorkflowClient} from '@/lib/lending/workflow-client'
import {ADMIN_FILTERS,type AdminLendingDashboard} from '@/lib/lending/admin-types'
import {LendingDashboard} from './LendingDashboard'
import {scheduleStatusNotifications} from '@/lib/lending/status-notifications'
export const maxDuration=60
export default async function LendingPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const actor=await adminLendingAccess()
 if(actor instanceof Response)return <p role="alert" className="text-amber-200">{(await actor.json()).error}</p>
 const params=await searchParams
 const search=typeof params.search==='string'?params.search.slice(0,100):'',filter=typeof params.filter==='string'&&Object.hasOwn(ADMIN_FILTERS,params.filter)?params.filter:'all'
 const page=typeof params.page==='string'&&/^\d+$/.test(params.page)?Math.min(10000,Math.max(1,Number(params.page))):1
 const {data,error}=await createWorkflowClient().rpc('lending_admin_dashboard',{p_actor:actor.id,p_search:search,p_filter:filter,p_page:page})
 if(error)return <div className="space-y-4"><h1 className="text-2xl font-bold">融資管理</h1><p role="alert" className="text-red-300">融資状況を取得できません。接続設定とデータベースの稼働状態を確認してください。</p></div>
 scheduleStatusNotifications()
 return <LendingDashboard data={data as AdminLendingDashboard} search={search} filter={filter as keyof typeof ADMIN_FILTERS}/>
}
