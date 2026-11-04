export const DUMMY_LENDING_BANK={bank:'サンプル銀行',branch:'サンプル支店',accountType:'普通',accountNumber:'0000000',accountName:'テスト コウザ',dummy:true} as const
export interface BankPaymentPreview {
 principalJpy:number;interestJpy:number;totalJpy:number;chargeLabel:'期限前返済手数料'|'質料';basisAt:string;calculatedAt:string;version:number;
 extensionAmountJpy:number;extensionMonths:1;unpaidMonths:number;dueAt:string;newDueAt:string;extensionAvailable:boolean;
}
export function repaymentChargeLabel(dueAt:string|null,basisAt:string):'期限前返済手数料'|'質料'{
 const day=(time:string)=>new Date(Date.parse(time)+9*3600000).toISOString().slice(0,10);
 return dueAt&&Number.isFinite(Date.parse(dueAt))&&Number.isFinite(Date.parse(basisAt))&&day(basisAt)<day(dueAt)?'期限前返済手数料':'質料';
}
