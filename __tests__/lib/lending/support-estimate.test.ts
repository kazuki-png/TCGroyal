import { describe, expect, it } from 'vitest';
import { buildSupportEstimateMessage, SUPPORT_LINE_URL, type SupportEstimateDraft } from '../../../mobile/src/support-estimate';
const draft: SupportEstimateDraft = { reason: 'ungraded', cardName: 'サンプルカード', cardNumber: 'サンプルセット 001/100', condition: '表面に傷あり', requestedAmount: '100000', notes: '未鑑定ですが担保にできるか相談したいです。' };

describe('individual support estimate', () => {
  it('includes the server-issued reference for LINE matching and rejects malformed references', () => {
    expect(buildSupportEstimateMessage(draft, 'TR-123456ABCDEF')).toContain('受付番号: TR-123456ABCDEF');
    expect(() => buildSupportEstimateMessage(draft, 'arbitrary-user-id')).toThrow();
  });
  it('prepares an ungraded-card inquiry without requiring or inventing a PSA number, grade or valuation', () => {
    const message = buildSupportEstimateMessage(draft);
    for (const text of ['未鑑定のカード', draft.cardName, draft.cardNumber, draft.condition, draft.notes, '100,000円', 'カード表面・裏面の写真']) expect(message).toContain(text);
    expect(message).not.toContain('PSA10'); expect(message).not.toContain('申込を受け付け');
    expect(SUPPORT_LINE_URL).toBe('https://lin.ee/Q6CsfJkl');
  });
  it('supports a missing certificate number and unknown optional details', () => {
    const message = buildSupportEstimateMessage({ ...draft, reason: 'no_certificate', cardNumber: '', condition: '', requestedAmount: '', notes: '' });
    expect(message).toContain('PSA鑑定番号がわからない・番号がない');
    expect(message).toContain('見積もり後に相談したい');
  });
  it('rejects empty names, oversized requests and malformed amounts before opening an external service', () => {
    for (const patch of [{ cardName: '  ' }, { cardName: 'あ'.repeat(101) }, { notes: 'あ'.repeat(1001) }, { requestedAmount: '-1' }, { requestedAmount: '1e6' }, { requestedAmount: '10000001' }, { reason: 'unknown' }]) {
      expect(() => buildSupportEstimateMessage({ ...draft, ...patch } as SupportEstimateDraft)).toThrow();
    }
  });
});
