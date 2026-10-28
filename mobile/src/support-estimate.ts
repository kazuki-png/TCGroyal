export const SUPPORT_LINE_URL = 'https://lin.ee/Q6CsfJkl';
export const ESTIMATE_REASONS = {
  ungraded: '未鑑定のカード',
  no_certificate: 'PSA鑑定番号がわからない・番号がない',
  other: 'その他・自動査定を利用できない',
} as const;
export type SupportEstimateDraft = {
  reason: keyof typeof ESTIMATE_REASONS;
  cardName: string;
  cardNumber: string;
  condition: string;
  requestedAmount: string;
  notes: string;
};
const clean = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
export function buildSupportEstimateMessage(draft: SupportEstimateDraft, reference?: string): string {
  if (reference !== undefined && !/^TR-[A-F0-9]{12}$/.test(reference)) throw Error('受付番号を確認できません。案件を再読み込みしてください。');
  if (!Object.hasOwn(ESTIMATE_REASONS, draft.reason)) throw Error('相談の種類を選択してください。');
  const name = clean(draft.cardName), number = clean(draft.cardNumber), condition = clean(draft.condition), notes = clean(draft.notes);
  const amount = draft.requestedAmount.trim();
  if (!name || name.length > 100) throw Error('カード名を100文字以内で入力してください。');
  if (number.length > 100 || condition.length > 300 || notes.length > 1000) throw Error('入力欄の文字数を確認してください。');
  if (amount && (!/^[1-9]\d{0,7}$/.test(amount) || Number(amount) > 10_000_000)) throw Error('借入希望額は1円から1,000万円までの数字で入力してください。');
  return [
    '【TCG ROYAL カード担保融資・個別見積もり相談】',
    ...(reference ? [`受付番号: ${reference}`] : []),
    `相談の種類: ${ESTIMATE_REASONS[draft.reason]}`,
    `カード名: ${name}`,
    `収録セット・カード番号: ${number || '不明・未入力'}`,
    `カードの状態・鑑定情報: ${condition || 'サポートと相談したい'}`,
    `借入希望額: ${amount ? `${Number(amount).toLocaleString('ja-JP')}円` : '見積もり後に相談したい'}`,
    `相談内容: ${notes || '上記カードの担保評価・融資可否の見積もりをお願いします。'}`,
    '',
    'カード表面・裏面の写真を、このメッセージと一緒に送ります。',
    '個別見積もりと、申込までの手続きを案内してください。',
  ].join('\n');
}
