import type {BundleEstimate} from './bundle-estimate-types';
export function requestedAmountError(value:string,estimate:BundleEstimate|null,now=Date.now()):string {
 if(value&&(!/^[1-9]\d{0,15}$/.test(value)||!Number.isSafeInteger(Number(value))))return '希望額は1円以上の整数で入力してください。';
 if(!estimate||!Number.isFinite(Date.parse(estimate.expiresAt))||Date.parse(estimate.expiresAt)<=now)return '最新の査定結果を確認してください。';
 if(value&&estimate.amountJpy!==null&&Number(value)>estimate.amountJpy)return `融資希望額は融資可能額（${estimate.amountJpy.toLocaleString('ja-JP')}円）以内で入力してください。`;
 return '';
}
