// Public response: provider prices and individual trading histories stay on the server.
export type BundleEstimate = {
 ruleVersion:'snkrdunk-observed-30d-v1';
 calculatedAt:string;expiresAt:string;
 status:'reference'|'manual';amountJpy:number|null;
 lines:{id:string;name:string;quantity:number;amountJpy:number|null;score:1|2|3|null;ltvPercent:40|50|60|null;reason:string}[];
 reason:string;
};
