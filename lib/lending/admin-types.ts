import type {WorkflowLoan,LoanStatus} from './workflow-types'
import type {SupportCase,SupportCaseStatus} from './support-case-types'
export const ADMIN_FILTERS={all:'すべて',review:'査定・相談',preparing:'入庫・条件確認・出金待ち',active:'契約中',repayment_pending:'入金確認待ち',due_soon:'7日以内の期限',overdue:'期限超過',return_pending:'返却待ち',closed:'終了'} as const
export type AdminFilter=keyof typeof ADMIN_FILTERS
export interface AdminLendingRow {
 kind:'case'|'loan';id:string;reference:string;user_id:string|null;customer_name:string;card_name:string;card_number:string|null;
 status:LoanStatus|SupportCaseStatus;requested_jpy:number|null;principal_jpy:number;offer_jpy:number|null;due_at:string|null;created_at:string;updated_at:string;bucket:string;has_pending_request:boolean;
}
export interface AdminLendingDashboard {
 rows:AdminLendingRow[];total:number;page:number;pageSize:number;evaluatedAt:string;
 summary:{outstandingJpy:number;activeCount:number;reviewCount:number;preparingCount:number;repaymentPendingCount:number;dueSoonCount:number;overdueCount:number;returnPendingCount:number};
}
export interface AdminCustomer {id:string;name:string;phone:string|null;identityVerified:boolean}
export type AdminLendingDetail={kind:'case';item:SupportCase;customer:AdminCustomer|null}|{kind:'loan';item:WorkflowLoan&{valuation_source:'support'|'snkrdunk';support_case:{id:string;reference:string;condition:string;notes:string}|null};customer:AdminCustomer|null}
