// Derived valuation and lending estimates only; individual trades stay on the server.
export type BundleEstimate = {
 ruleVersion:'snkrdunk-observed-30d-v1'|'snkrdunk-observed-average-30pct-v2'|'three-month-average-preview-v3';
 calculatedAt:string;expiresAt:string;
 status:'reference'|'manual';amountJpy:number|null;valuationJpy?:number|null;
 lines:{id:string;name:string;quantity:number;amountJpy:number|null;valuationJpy?:number|null;score:1|2|3|null;ltvPercent:30|40|50|60|null;reason:string}[];
 reason:string;
};
