import {z} from 'zod'
import {collateralInspection} from './collateral'
const money=z.number().int().min(0).max(10000000)
export const workflowInputSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('quote'),cardUid:z.uuid()}).strict(),
 z.object({type:z.literal('apply'),quoteId:z.uuid(),certInput:z.string().max(250),amountJpy:money.min(100000),deposit:z.enum(['mail','store']),key:z.uuid()}).strict(),
 z.object({type:z.literal('verify_mapping'),cardUid:z.uuid(),productId:z.string().regex(/^[1-9]\d{0,8}$/),verified:z.literal(true)}).strict(),
 z.object({type:z.literal('command'),loanId:z.uuid(),version:z.number().int().positive(),key:z.uuid(),action:z.enum(['receive','offer','accept','fund','cancel','reject','report_repayment','reject_repayment','confirm_repayment','return','request_extension','request_additional','extend','reject_request','forfeit']),payload:z.object({
  amountJpy:money.optional(),monthlyRateBps:z.number().int().min(0).max(200).optional(),location:z.string().trim().max(120).optional(),certNumber:z.string().regex(/^\d{6,12}$/).optional(),inspected:z.boolean().optional(),termsAccepted:z.boolean().optional(),reviewed:z.boolean().optional(),reference:z.string().trim().min(4).max(120).optional(),reason:z.string().trim().min(1).max(500).optional(),manualValuationJpy:z.number().int().min(1).max(1000000000).optional(),manualCapJpy:money.min(100000).optional(),
  collateralInspection:collateralInspection.optional(),allItemsReturned:z.boolean().optional(),
 }).strict()}).strict(),
])
