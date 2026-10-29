// KYC reviewer is an administrator with additional document-review access,
// not a role excluded from ordinary administration (007_kyc_security.sql).
export function isAdministrativeRole(role:unknown):role is 'admin'|'kyc_reviewer'{
 return role==='admin'||role==='kyc_reviewer'
}
