export const SUPPORT_LINE_URL = 'https://lin.ee/Q6CsfJkl';
export const ESTIMATE_REASONS = {
  ungraded: '未鑑定のカード',
  no_certificate: '鑑定情報が不明なカード',
  other: 'その他・自動査定を利用できない',
} as const;
export type SupportEstimateDraft = {
  items?:import('../../lib/lending/collateral-types').CollateralItem[];
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
  if(draft.items&&(draft.items.length<1||draft.items.length>20||draft.items.reduce((sum,item)=>sum+item.quantity,0)>100||draft.items.some(item=>!item.name.trim()||item.name.length>100||!Number.isInteger(item.quantity)||item.quantity<1||item.cardNumber.length>100||item.grade.length>60||item.condition.length>300)))throw Error('カードは20種類・合計100枚までで、枚数と明細を確認してください。');
  return [
    '【TCG ROYAL カード担保融資・個別見積もり相談】',
    ...(reference ? [`受付番号: ${reference}`] : []),
    `相談の種類: ${ESTIMATE_REASONS[draft.reason]}`,
    `カード名: ${name}`,
    `収録セット・カード番号: ${number || '不明・未入力'}`,
    `カードの状態・鑑定情報: ${condition || 'サポートと相談したい'}`,
    ...(draft.items?draft.items.flatMap((item,index)=>[`${index+1}. ${item.name.slice(0,60)} / ${item.quantity}枚`,`型番: ${item.cardNumber.slice(0,60)||'不明'} / 鑑定・グレード: ${item.grade.slice(0,30)||'未申告'} / 状態: ${item.condition.slice(0,60)||'要確認'}`,...(item.productId?[`https://snkrdunk.com/apparels/${item.productId}`]:[])]):[]),
    `借入希望額: ${amount ? `${Number(amount).toLocaleString('ja-JP')}円` : '見積もり後に相談したい'}`,
    `相談内容: ${notes || '上記カードの担保評価・融資可否の見積もりをお願いします。'}`,
    '',
    'カード表面・裏面の写真を、このメッセージと一緒に送ります。',
    '個別見積もりと、申込までの手続きを案内してください。',
  ].join('\n');
}
