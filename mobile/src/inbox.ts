import type { AccountState } from '../../lib/lending/mobile-types';
import { LOAN_STATUS_LABELS, type WorkflowState } from '../../lib/lending/workflow-types';
import {SUPPORT_CASE_STATUS,type SupportCase} from '../../lib/lending/support-case-types';

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  date: string;
  dateLabel: string;
  target: 'loans' | 'account';
  loanId?: string;
  urgent?: boolean;
}

const actionTitles: Record<string, string> = {
  apply: '融資申請を受け付けました', receive: 'カードの検品が完了しました',
  offer: '融資条件をご確認ください', accept: '融資条件への同意を受け付けました',
  fund: '融資の実行が記録されました', report_repayment: '返済の申告を受け付けました',
  confirm_repayment: '返済を確認しました', reject_repayment: '返済の確認結果をご確認ください',
  return: 'カードの返却が完了しました', cancel: '申込の取消を受け付けました',
  reject: '申込の確認結果をご確認ください', extend: '返済期限を延長しました',
  request_extension: '延長申請を受け付けました', request_additional: '追加借入の相談を受け付けました',
  reject_request: '申請の確認結果をご確認ください', forfeit: '契約の状態をご確認ください',
};

// Build the inbox from authenticated business records, never from push test logs.
export function buildInbox(workflow: WorkflowState | null, account: AccountState | null, now: number,cases:SupportCase[]=[]): InboxItem[] {
  const items: InboxItem[] = [];
  for (const loan of workflow?.loans ?? []) {
    for (const event of loan.events) {
      if (!Number.isFinite(Date.parse(event.created_at))) continue;
      items.push({ id: `loan:${loan.id}:${event.version}`, title: actionTitles[event.action] ?? `申込状況が「${LOAN_STATUS_LABELS[event.to_status]}」になりました`,
        body: `${loan.card_name}${loan.cert_number?` / PSA ${loan.cert_number}`:''}`, date: event.created_at, dateLabel: '更新日時', target: 'loans', loanId: loan.id });
    }
    const due = Date.parse(loan.due_at ?? '');
    const remaining = due - now;
    // Suppress reminders while repayment is being reconciled and after closure.
    if (loan.status === 'active' && Number.isFinite(due) && remaining <= 7 * 86400000) {
      const stage = remaining <= 0 ? 'overdue' : remaining <= 3 * 86400000 ? '3days' : '7days';
      items.push({ id: `due:${loan.id}:${loan.due_at}:${stage}`,
        title: remaining <= 0 ? '返済期限を過ぎています' : '返済期限が近づいています',
        body: `${loan.card_name}の返済期限をご確認ください。`, date: loan.due_at!, dateLabel: '返済期限', target: 'loans', loanId: loan.id, urgent: true });
    }
  }
  for(const item of cases){for(const event of item.events??[]){if(event.to_status==='applied'||!Number.isFinite(Date.parse(event.created_at)))continue;items.push({id:`case:${item.id}:${event.version}`,title:`査定状況が「${SUPPORT_CASE_STATUS[event.to_status]}」になりました`,body:`${item.card_name} / 受付番号 ${item.reference}`,date:event.created_at,dateLabel:'更新日時',target:'loans'});}}
  for (const document of account?.documents ?? []) {
    const status = { pending: '本人確認書類を受け付けました', verified: '本人確認書類の確認が完了しました', rejected: '本人確認書類の再提出が必要です' }[document.status];
    if (!status || !Number.isFinite(Date.parse(document.uploaded_at))) continue;
    items.push({ id: `document:${document.id}:${document.status}`, title: status,
      body: `運転免許証の${document.side === 'front' ? '表面' : '裏面'}。本人確認の現在の状態はマイページでご確認ください。`,
      date: document.uploaded_at, dateLabel: '書類提出日時', target: 'account', urgent: document.status === 'rejected' });
  }
  for (const assessment of account?.assessments ?? []) {
    const title = { draft: '査定参考額を取得しました', submitted: '査定依頼を受け付けました', cancelled: '査定依頼を取り消しました' }[assessment.status];
    const date = assessment.submitted_at ?? assessment.created_at;
    if (!title || !Number.isFinite(Date.parse(date))) continue;
    items.push({ id: `assessment:${assessment.id}:${assessment.status}`, title,
      body: `${assessment.product.name} / PSA ${assessment.cert_number}。査定履歴から内容を確認できます。`,
      date, dateLabel: assessment.status === 'submitted' ? '依頼日時' : '査定作成日時', target: 'account' });
  }
  return items.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id)).slice(0, 200);
}

export function parseReadIds(raw: string | null): string[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || id.length > 250)) throw Error('invalid_receipts');
  return [...new Set(value as string[])].slice(-500);
}
