export function isLendingApiPath(path:string){
 return /^\/(?:cards|catalog|card-image|account|documents|notifications|identity|support-cases)(?:\?id=[a-f0-9-]{36})?$/.test(path)
  || /^\/workflow\?view=(?:payment|repayment)&loanId=[a-f0-9-]{36}&date=\d{4}-\d{2}-\d{2}$/.test(path);
}
