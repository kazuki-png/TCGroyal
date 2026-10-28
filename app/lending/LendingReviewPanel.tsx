'use client'
import {useEffect,useState} from 'react'
type Data={assessments:{id:string;user_id:string;cert_number:string;product:{name:string;sourceUrl:string};estimate_jpy:number}[];documents:{id:string;user_id:string;document_type:string;side:string}[]}
export function LendingReviewPanel({role='customer'}:{role?:'admin'|'customer'}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function load(){const r=await fetch('/api/lending/reviews',{cache:'no-store',headers:{'x-lending-demo-role':role}});const d=await r.json();if(!r.ok)throw Error(d.error);setData(d);setError('')}
 useEffect(()=>{let live=true;void fetch('/api/lending/reviews',{cache:'no-store',headers:{'x-lending-demo-role':role}}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(live){setData(d);setError('')};setError('')}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[role])
 async function review(documentId:string,approve:boolean){
  if(!window.confirm(approve?'検証用の本人確認を承認します。実際のJPKI確認ではありません。':'書類を差し戻します。'))return
  setBusy(true);setError('');try{const r=await fetch('/api/lending/reviews',{method:'POST',headers:{'Content-Type':'application/json','x-lending-demo-role':role},body:JSON.stringify({documentId,approve,testOnlyConfirmed:true})});const d=await r.json();if(!r.ok)throw Error(d.error);await load()}catch(e){setError(e instanceof Error?e.message:'操作できません。')}finally{setBusy(false)}
 }
 return <section className="space-y-4 rounded-2xl border border-white/10 bg-[#111b2d] p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">モバイルからの査定・書類確認</h2><button disabled={busy} className="text-amber-200 underline" onClick={()=>void load().catch(e=>setError(e.message))}>更新</button></div>
  {error&&<p role="alert" className="text-red-300">{error}</p>}
  <p className="text-sm text-zinc-400">各50件まで。未登録商品の査定依頼は、カードマスタとスニダン商品対応・買取価格を確認し、登録後に利用者が再査定して申込に進みます。</p>
  {data?.assessments?.map(a=><article key={a.id} className="space-y-2 rounded-lg border border-white/10 p-4"><p>{a.product.name}</p><p className="text-sm">PSA {a.cert_number} / 参考額 ¥{a.estimate_jpy.toLocaleString('ja-JP')}</p><p className="break-all text-xs text-zinc-400">会員ID: {a.user_id}</p><a className="text-amber-200 underline" target="_blank" rel="noreferrer" href={a.product.sourceUrl}>スニダン商品を見る</a></article>)}
  {data?.documents?.map(d=><article key={d.id} className="space-y-3 rounded-lg border border-white/10 p-4"><p>{d.document_type} / {d.side} / 確認待ち</p><p className="break-all text-xs text-zinc-400">会員ID: {d.user_id}</p><div className="flex flex-wrap gap-4"><button disabled={busy} className="text-amber-200 underline" onClick={()=>{void fetch(`/api/lending/reviews?documentId=${d.id}`,{cache:'no-store',headers:{'x-lending-demo-role':role}}).then(async r=>{const value=await r.json();if(!r.ok)throw Error(value.error);window.open(value.url,'_blank','noopener,noreferrer')}).catch(e=>setError(e.message))}}>書類を見る（閲覧記録あり）</button><button disabled={busy} className="text-amber-200 underline" onClick={()=>void review(d.id,true)}>テスト本人確認を承認</button><button disabled={busy} className="text-red-300 underline" onClick={()=>void review(d.id,false)}>差し戻す</button></div></article>)}
  {data&&data.assessments?.length===0&&data.documents?.length===0&&<p className="text-sm text-zinc-400">確認待ちはありません。</p>}
 </section>
}
