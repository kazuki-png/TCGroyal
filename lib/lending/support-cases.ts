import {z} from 'zod'
import {collateralItems} from './collateral'
const draft=z.object({reason:z.enum(['ungraded','no_certificate','other']),cardName:z.string().trim().min(1).max(100),cardNumber:z.string().trim().max(100),condition:z.string().trim().max(300),notes:z.string().trim().max(1000),requestedAmount:z.union([z.literal(''),z.string().regex(/^[1-9]\d{0,7}$/).refine(v=>Number(v)<=10000000)]),items:collateralItems.optional()}).strict()
const money=z.number().int().min(100000).max(10000000).refine(v=>v%10000===0)
const payload=z.object({message:z.string().trim().max(500).optional(),userId:z.uuid().optional(),amountJpy:money.optional(),valuationJpy:z.number().int().min(1).max(1000000000).optional(),termsAccepted:z.literal(true).optional(),deposit:z.enum(['mail','store']).optional()}).strict()
export const supportCaseRequest=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),key:z.uuid(),draft,consent:z.literal(true),userId:z.uuid().optional(),contactLabel:z.string().trim().max(100).optional()}).strict(),
 z.object({action:z.enum(['review','request_info','offer','decline','link','accept','cancel']),key:z.uuid(),caseId:z.uuid(),version:z.number().int().positive(),payload}).strict(),
])
export const supportCaseError=(message:string)=>({version_conflict:'別の操作で更新されました。一覧を更新して再確認してください。',customer_link_required:'先に会員を紐付けてください。',customer_link_invalid:'会員IDを確認してください。紐付け済みの会員は変更できません。',customer_not_found:'会員が見つかりません。',adult_profile_required:'申込には生年月日を登録し、18歳以上であることを確認する必要があります。',customer_limit_exceeded:'現在の申込・契約との合計が利用上限を超えます。',consent_or_offer_required:'見積もりの期限と同意内容を確認してください。',amount_invalid:'見積もり額・評価額・借入希望額を確認してください。',reason_required:'利用者へ表示する案内を入力してください。',idempotency_conflict:'送信内容が変更されています。一覧を更新してください。',invalid_transition:'現在の状態ではこの操作を行えません。'} as Record<string,string>)[message]??'案件を更新できません。会員・入力内容・現在の状態を確認してください。'
