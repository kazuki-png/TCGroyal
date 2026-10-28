import 'server-only'
import { getWorkflowActor } from './workflow-server'
import { isLendingEnabled, isSameOriginRequest } from './local-config'
import { checkWorkflowRateLimit } from './workflow-client'
import { rateLimitResponse } from '@/lib/security/rateLimit'
export const lendingJson = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
export async function lendingAccess(request: Request, scope: string, limit = 30) {
 if (!isLendingEnabled()) return lendingJson({error:'融資テスト環境が構成されていません。'},503)
 const actor=await getWorkflowActor(request)
 if(!actor)return lendingJson({error:'接続の有効期限が切れました。接続し直してください。'},401)
 if(request.method!=='GET'&&!isSameOriginRequest(request))return lendingJson({error:'不正な送信元です。'},403)
 const rate=await checkWorkflowRateLimit(scope,actor.id,{limit,windowMs:60000})
 return rate.allowed?actor:rateLimitResponse(rate)
}
export async function boundedBody(request: Request, maxBytes: number) {
 if(Number(request.headers.get('content-length')??0)>maxBytes)throw Error('入力が大きすぎます。')
 const reader=request.body?.getReader();if(!reader)throw Error('入力がありません。')
 const chunks:Uint8Array[]=[];let size=0
 try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw Error('入力が大きすぎます。');chunks.push(value)}}
 finally {await reader.cancel().catch(()=>{})}
 return Buffer.concat(chunks)
}
