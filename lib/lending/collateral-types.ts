export interface CollateralItem {
 id:string;name:string;cardNumber:string;quantity:number;grade:string;condition:string;
 source:'snkrdunk'|'catalog'|'manual';productId:string|null;cardUid:string|null;
}
export interface CollateralInspection {id:string;quantity:number;location:string;checked:boolean}
export const collateralQuantity=(items:CollateralItem[])=>items.reduce((sum,item)=>sum+item.quantity,0);
// A declared defect must not receive an undamaged PSA10 reference amount.
export const conditionNeedsReview=(condition:string)=>/傷|破損|折れ|白[か欠]け|汚れ|擦れ|割れ|欠け/u.test(condition.replace(/(?:傷|破損|折れ|白[か欠]け|汚れ|擦れ|割れ|欠け)(?:なし|無し|はありません)/gu,''));
export function collateralTitle(items:CollateralItem[]){
 if(!items.length)return '';
 return `${items[0].name.slice(0,60)}${items.length>1?` ほか${items.length-1}種類`:''} / 合計${collateralQuantity(items)}枚`;
}
