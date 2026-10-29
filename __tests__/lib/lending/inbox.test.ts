import { describe, expect, it } from 'vitest';
import { buildInbox, parseReadIds } from '../../../mobile/src/inbox';
import type { WorkflowLoan, WorkflowState } from '@/lib/lending/workflow-types';
import type { AccountState } from '@/lib/lending/mobile-types';
import type {SupportCase} from '@/lib/lending/support-case-types';

const now = Date.parse('2026-10-27T00:00:00Z');
const day = 86400000;
const loan: WorkflowLoan = {
  id: 'loan-a', version: 1, status: 'active', cert_number: '167034272', card_name: 'CARD A',
  card_number: null, requested_jpy: 100000, offered_jpy: 100000, principal_jpy: 100000,
  monthly_rate_bps: 300, due_at: new Date(now + 7 * day).toISOString(), funded_at: null,
  created_at: new Date(now - day).toISOString(), evaluated_at: new Date(now).toISOString(),
  storage_location: null, payoff_jpy: 103000, terms: null, terms_accepted_at: null,
  ledger: [], requests: [], events: [{ action: 'offer', to_status: 'offered', version: 1, created_at: new Date(now - day).toISOString() }],
};
const state = (loans: WorkflowLoan[]): WorkflowState => ({ outstandingJpy: 100000, loanCount: loans.length, role: 'customer', demo: true, marketFixture: true, identityVerified: false, cards: [], loans });
const account: AccountState = {
  profile: { last_name: '', first_name: '', last_name_kana: '', first_name_kana: '', birthday: null, postal_code: null, address: null, phone: null, updated_at: new Date(now).toISOString() },
  summary: { outstandingJpy: 0, payoffJpy: 0, nextDueAt: null, activeCount: 0 }, documents: [], assessments: [],
  notifications: [{ id: 'push-test', status: 'received', created_at: new Date(now).toISOString(), received_at: null, error_code: null }],
  identity: { method: null, expiresAt: null, status: 'unverified' }, phone: { status: 'unverified', verifiedAt: null },
  capabilities: { psaConfigured: false, remotePushConfigured: false, phoneConfigured: false, preview: true, documentUploadEnabled: true, jpkiConfigured: false },
};

describe('business inbox', () => {
  it('shows consultation status changes and avoids a duplicate case-to-loan application notice',()=>{
    const item={id:'case-a',reference:'TR-ABC',card_name:'カードA',events:[{id:'e1',version:2,to_status:'reviewing',created_at:new Date(now).toISOString(),action:'review',message:'確認中'},{id:'e2',version:3,to_status:'applied',created_at:new Date(now).toISOString(),action:'accept',message:''}]} as SupportCase;
    const items=buildInbox(null,null,now,[item]);expect(items).toHaveLength(1);expect(items[0]).toMatchObject({id:'case:case-a:2',title:'査定状況が「査定中」になりました',target:'loans'});
  });
  it('does not turn push test logs into business notifications', () => {
    expect(buildInbox(state([]), account, now)).toEqual([]);
    expect(buildInbox(null, null, now)).toEqual([]);
  });
  it('links actual loan events to their contract and preserves distinct event versions', () => {
    const data = buildInbox(state([{ ...loan, due_at: null, events: [...loan.events, { ...loan.events[0], version: 2, action: 'fund', to_status: 'active' }] }]), null, now);
    expect(data).toHaveLength(2);
    expect(new Set(data.map(item => item.id)).size).toBe(2);
    expect(data.find(item => item.id.endsWith(':1'))).toMatchObject({ title: '融資条件をご確認ください', loanId: loan.id, target: 'loans' });
  });
  it('changes reminder IDs at the 7-day, 3-day and overdue boundaries', () => {
    const reminders = [now, now + 4 * day, now + 7 * day].map(time => buildInbox(state([loan]), null, time).find(item => item.id.startsWith('due:'))!);
    expect(reminders.map(item => item.id.split(':').at(-1))).toEqual(['7days', '3days', 'overdue']);
    expect(reminders[2].title).toBe('返済期限を過ぎています');
    expect(buildInbox(state([loan]), null, now - 1).some(item => item.id.startsWith('due:'))).toBe(false);
  });
  it('suppresses reminders after closure, during reconciliation, and after extension beyond 7 days', () => {
    for (const status of ['repayment_pending', 'returned', 'forfeited', 'cancelled'] as const) {
      expect(buildInbox(state([{ ...loan, status }]), null, now).some(item => item.id.startsWith('due:'))).toBe(false);
    }
    expect(buildInbox(state([{ ...loan, due_at: new Date(now + 90 * day).toISOString() }]), null, now).some(item => item.id.startsWith('due:'))).toBe(false);
  });
  it('does not infer overall identity approval from a single verified document', () => {
    const document = { id: 'doc-a', document_type: 'drivers_license', side: 'front', status: 'verified', uploaded_at: new Date(now - day).toISOString() };
    const item = buildInbox(null, { ...account, documents: [document] }, now)[0];
    expect(item).toMatchObject({ id: 'document:doc-a:verified', dateLabel: '書類提出日時', target: 'account' });
    expect(item.body).toContain('本人確認の現在の状態はマイページ');
    const rejected = buildInbox(null, { ...account, documents: [{ ...document, status: 'rejected' }] }, now)[0];
    expect(rejected.id).not.toBe(item.id); expect(rejected.urgent).toBe(true);
  });
  it('prioritizes deadline reminders and ignores invalid event timestamps', () => {
    const invalid = { ...loan.events[0], version: 5, created_at: 'invalid' };
    const items = buildInbox(state([{ ...loan, events: [...loan.events, invalid] }]), null, now);
    expect(items).toHaveLength(2); expect(items[0].urgent).toBe(true);
  });
  it('keeps assessment references separate from final loan offers', () => {
    const assessment: AccountState['assessments'][number] = { id: 'a', cert_number: '167034272', product_id: 'p', product: { name: 'CARD A', englishName: '', sourceUrl: '' }, estimate_jpy: 100000, quote_id: null, status: 'draft', created_at: new Date(now).toISOString(), expires_at: new Date(now + day).toISOString(), submitted_at: null };
    expect(buildInbox(null, { ...account, assessments: [assessment] }, now)[0]).toMatchObject({ title: '査定参考額を取得しました', target: 'account' });
  });
  it('validates and bounds stored receipts without accepting arbitrary objects', () => {
    expect(parseReadIds(null)).toEqual([]);
    expect(parseReadIds('["one","one","two"]')).toEqual(['one', 'two']);
    expect(parseReadIds(JSON.stringify(Array.from({ length: 550 }, (_, i) => String(i))))).toHaveLength(500);
    expect(() => parseReadIds('{"admin":true}')).toThrow();
    expect(() => parseReadIds('[123]')).toThrow();
  });
});
