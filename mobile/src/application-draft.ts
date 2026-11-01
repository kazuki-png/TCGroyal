import type {CollateralItem} from '../../lib/lending/collateral-types';
export interface ApplicationDraft {version:1;items:CollateralItem[];updatedAt:string}
export function parseApplicationDraft(raw:string|null):ApplicationDraft{
 if(!raw)return {version:1,items:[],updatedAt:new Date().toISOString()};
 const value=JSON.parse(raw);
 if(value.version!==1||!Array.isArray(value.items)||value.items.length>20)throw Error('invalid_draft');
 const items:CollateralItem[]=value.items.map((row:CollateralItem)=>{
  if(!row||typeof row.id!=='string'||!/^[0-9a-f-]{36}$/i.test(row.id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>100||typeof row.cardNumber!=='string'||row.cardNumber.length>100||typeof row.grade!=='string'||row.grade.length>60||typeof row.condition!=='string'||row.condition.length>300||!Number.isInteger(row.quantity)||row.quantity<0||row.quantity>100||!['catalog','snkrdunk','manual'].includes(row.source)||(row.cardUid!==null&&typeof row.cardUid!=='string')||(row.productId!==null&&typeof row.productId!=='string'))throw Error('invalid_draft');
  // Allowlisted fields only: never persist credentials, documents or bank inputs.
  return {id:row.id,name:row.name,cardNumber:row.cardNumber,grade:row.grade,condition:row.condition,quantity:row.quantity,source:row.source,cardUid:row.cardUid,productId:row.productId};
 });
 if(items.reduce((sum,row)=>sum+row.quantity,0)>100||new Set(items.map(row=>row.id)).size!==items.length)throw Error('invalid_draft');
 return {version:1,items,updatedAt:typeof value.updatedAt==='string'?value.updatedAt:new Date().toISOString()};
}
