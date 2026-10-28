export interface Certificate {
 verifiedBy:'psa_api'|'user_entered';
 certNumber:string;specId:number|null;year:string;brand:string;category:string;cardNumber:string;subject:string;variety:string;
 grade:string;gradeDescription:string;eligible:boolean;sourceUrl:string;fetchedAt:string
}
export interface ProductCandidate {productId:string;name:string;sourceUrl:string}
export interface CertificateLookup {id:string;certificate:Certificate;candidates:ProductCandidate[];searchQuery:string;searchWarning?:string;cacheHit?:boolean}
export interface Assessment {
 id:string;cert_number:string;product_id:string;product:{name:string;englishName:string;sourceUrl:string};estimate_jpy:number;
 quote_id:string|null;status:'draft'|'submitted'|'cancelled';created_at:string;expires_at:string;submitted_at:string|null
}
export interface LendingProfile {
 last_name:string;first_name:string;last_name_kana:string;first_name_kana:string;birthday:string|null;
 postal_code:string|null;address:string|null;phone:string|null;updated_at:string
}
export interface AccountState {
 authentication?:{provider:string;email?:string;emailVerified?:boolean};
 profile:LendingProfile;
 summary:{outstandingJpy:number;payoffJpy:number;nextDueAt:string|null;activeCount:number};
 documents:{id:string;document_type:string;side:string;status:string;uploaded_at:string}[];
 assessments:Assessment[];
 notifications:{id:string;status:string;created_at:string;received_at:string|null;error_code:string|null}[];
 identity:{method:'jpki'|'test_fixture'|null;expiresAt:string|null;status:'verified'|'test_verified'|'unverified'};
 phone:{status:'test_verified'|'unverified';verifiedAt:string|null};
 capabilities:{psaConfigured:boolean;remotePushConfigured:boolean;phoneConfigured:boolean;preview:boolean;documentUploadEnabled:boolean;jpkiConfigured:boolean}
}
