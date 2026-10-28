import 'server-only'
import { z } from 'zod'
import { parsePsaCert } from './psa'
import { fetchPublicRemoteUrl } from '@/lib/security/safeRemoteFetch'
const text=z.string().max(500)
const psaSchema=z.object({PSACert:z.object({CertNumber:z.string().regex(/^\d{6,12}$/),SpecID:z.number().int().optional(),
 Year:text,Brand:text,Category:text,CardNumber:text,Subject:text.min(1),Variety:text,CardGrade:text,GradeDescription:text,
 IsPSADNA:z.boolean().optional(),IsDualCert:z.boolean().optional(),ItemStatus:text.optional()})})
export function parsePsaCertificate(input:unknown,cert:string) {
 const {PSACert:p}=psaSchema.parse(input)
 if(p.CertNumber!==cert)throw Error('PSAの鑑定番号が一致しません。')
 if(p.IsPSADNA||p.IsDualCert||!['','ACTIVE','VALID'].includes((p.ItemStatus??'').trim().toUpperCase()))throw Error('この鑑定品は自動査定の対象外です。運営へお問い合わせください。')
 return {verifiedBy:'psa_api' as const,certNumber:p.CertNumber,specId:p.SpecID??null,year:p.Year,brand:p.Brand,category:p.Category,cardNumber:p.CardNumber,
  subject:p.Subject,variety:p.Variety,grade:p.CardGrade,gradeDescription:p.GradeDescription,
  eligible:p.CardGrade.trim()==='10'&&/^(?:GEM\s*(?:MINT|MT)\s*10|10)$/i.test(p.GradeDescription.trim())&&/POK[EÉ]MON|ONE\s*PIECE/i.test(p.Brand),
  sourceUrl:`https://www.psacard.com/cert/${p.CertNumber}/psa`,fetchedAt:new Date().toISOString()}
}
export type PsaCertificate=ReturnType<typeof parsePsaCertificate>
export const PSA_CERT_CACHE_MS=24*60*60*1000
const cachedSchema=z.object({verifiedBy:z.literal('psa_api'),certNumber:z.string(),specId:z.number().int().nullable(),
 year:text,brand:text,category:text,cardNumber:text,subject:text.min(1),variety:text,grade:text,gradeDescription:text,
 fetchedAt:z.iso.datetime({offset:true})})
export function readCachedPsaCertificate(input:unknown,cert:string,now=Date.now()):PsaCertificate|null {
 const parsed=cachedSchema.safeParse(input)
 if(!parsed.success)return null
 const p=parsed.data,age=now-Date.parse(p.fetchedAt)
 if(p.certNumber!==cert||age<0||age>=PSA_CERT_CACHE_MS)return null
 // Recompute eligibility from the original label, never a stored boolean.
 try{return {...parsePsaCertificate({PSACert:{CertNumber:p.certNumber,SpecID:p.specId??undefined,
  Year:p.year,Brand:p.brand,Category:p.category,CardNumber:p.cardNumber,Subject:p.subject,Variety:p.variety,
  CardGrade:p.grade,GradeDescription:p.gradeDescription}},cert),fetchedAt:p.fetchedAt}}
 catch{return null}
}
export async function fetchPsaCertificate(input:string) {
 const cert=parsePsaCert(input);if(!cert)throw Error('PSA番号または公式QRコードURLを入力してください。')
 const token=process.env.PSA_API_ACCESS_TOKEN?.trim().replace(/^bearer\s+/i,'')
 if(!token)throw Error('PSA公式APIの接続設定が必要です。運営がAPIトークンを設定後、番号から自動検索できます。')
 if(token.length>8192||!/^[A-Za-z0-9._~+/-]+=*$/.test(token))throw Error('PSAトークンの保存形式が不正です。引用符や途中の改行が含まれていないか確認してください。')
 const r=await fetchPublicRemoteUrl(new URL(`https://api.psacard.com/publicapi/cert/GetByCertNumber/${cert}`),{
  timeoutMs:10000,maxBytes:128000,maxRedirects:0,headers:{Accept:'application/json',Authorization:`bearer ${token}`,'User-Agent':'TCG-Royal-Lending/1.0'}})
 if(!r.ok||!r.headers.get('content-type')?.includes('json')){
  // Status and MIME type only: never log the credential or upstream response body.
  console.warn('PSA API response rejected',{status:r.status,contentType:r.headers.get('content-type')?.slice(0,100)??null})
  // Match the known provider message, but never expose or log arbitrary bodies.
  const errorBody=!r.ok?await r.text().catch(()=>''):''
  if(/API calls quota exceeded/i.test(errorBody)&&/maximum admitted\s+100\s+per\s+Day/i.test(errorBody)){
   throw Error('PSA公式APIの1日100件の利用上限に達しています。連続して再試行せず、PSA側の利用枠回復後にお試しください。')
  }
  if(r.status===401)throw Error('PSA公式APIの認証に失敗しました（HTTP 401）。トークンを確認してください。')
  if(r.status===429)throw Error('PSA公式APIの利用上限に達しました（HTTP 429）。時間をおいて再度お試しください。')
  throw Error(`PSA公式APIから鑑定情報を取得できません（HTTP ${r.status}）。運営が接続状態を確認してください。`)
 }
 try{return parsePsaCertificate(await r.json(),cert)}catch(error){if(error instanceof z.ZodError)throw Error('PSAに鑑定情報が見つからないか、応答形式が変わりました。');throw error}
}
