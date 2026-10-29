export const LOAN_STATUS_LABELS = {
  submitted: '到着待ち', received: '検品済み', offered: '条件の確認待ち', accepted: '出金待ち',
  active: '契約中', repayment_pending: '入金確認待ち', return_pending: '返却待ち',
  returned: '返却済み', forfeited: '質流れ', rejected: '見送り', cancelled: 'キャンセル',
} as const
export type LoanStatus = keyof typeof LOAN_STATUS_LABELS
export type LoanCommand = 'receive' | 'offer' | 'accept' | 'fund' | 'cancel' | 'reject'
  | 'report_repayment' | 'reject_repayment' | 'confirm_repayment' | 'return' | 'request_extension'
  | 'request_additional' | 'extend' | 'reject_request' | 'forfeit'
export interface WorkflowLoan {
  collateral_items?:import('./collateral-types').CollateralItem[];
  collateral_inspection?:import('./collateral-types').CollateralInspection[];
  id: string; version: number; status: LoanStatus; cert_number: string | null; card_name: string
  card_number: string | null; requested_jpy: number; offered_jpy: number | null
  principal_jpy: number; monthly_rate_bps: number | null; due_at: string | null
  funded_at: string | null; created_at: string; evaluated_at: string; storage_location: string | null
  payoff_jpy: number; terms: { version: number; principalJpy: number; monthlyRateBps: number; termMonths: number; feesJpy: number; documentVersion: string;collateralItems?:import('./collateral-types').CollateralItem[] } | null
  terms_accepted_at: string | null
  events: { action: string; to_status: LoanStatus; version: number; created_at: string; reason?: string | null }[]
  ledger: { id: string; kind: string; amount_jpy: number; created_at: string }[]
  requests: { id: string; kind: 'extension' | 'additional'; amount_jpy: number; status: string; consent_terms: { oldDueAt?: string; newDueAt?: string; requiresNewAssessment?: boolean; requiresNewAgreement?: boolean } }[]
}
export interface WorkflowState {
  outstandingJpy: number; loanCount: number
  role: 'customer' | 'admin'; demo: boolean; marketFixture: boolean; identityVerified: boolean
  cards: { public_uid: string; name: string; card_number: string | null; productId: string }[]
  loans: WorkflowLoan[]
}
