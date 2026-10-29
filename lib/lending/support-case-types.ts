import type { LoanStatus } from './workflow-types'
export const SUPPORT_CASE_STATUS = { registered:'相談登録',reviewing:'査定中',information_required:'追加情報待ち',offered:'見積もり提示',applied:'申込済み',declined:'見送り',cancelled:'キャンセル' } as const
export type SupportCaseStatus=keyof typeof SUPPORT_CASE_STATUS
export interface SupportCase {
 id:string;reference:string;user_id:string|null;source:'app'|'admin';reason:'ungraded'|'no_certificate'|'other';
 card_name:string;card_number:string;condition:string;notes:string;contact_label?:string;
 status:SupportCaseStatus;requested_jpy:number|null;valuation_jpy:number|null;offer_jpy:number|null;
 offer_note:string|null;offer_expires_at:string|null;loan_id:string|null;loan_status?:LoanStatus|null;
 version:number;created_at:string;updated_at:string;
 card_uid?:string|null;selected_card?:import('./catalog-types').CatalogCard|null;search_method?:'catalog'|'image'|null;
 declared_grade?:string|null;declared_cert_number?:string|null;indicative_jpy?:number|null;
 events?:{id:string;action:string;to_status:SupportCaseStatus;version:number;message:string;created_at:string}[]
}
export interface SupportCaseList {cases:SupportCase[];total:number}
