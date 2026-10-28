// Explicit opt-in: creates a synthetic completed loan in the selected Preview.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
if (process.env.RUN_LENDING_PREVIEW_TEST !== '1') throw Error('Set RUN_LENDING_PREVIEW_TEST=1 to test the selected Preview.');
const fixtures=JSON.parse(readFileSync('.env.lending-preview-fixtures.local','utf8'));
const access=JSON.parse(readFileSync('.env.lending-preview-access.local','utf8'));
assert.equal(fixtures.config.LENDING_PREVIEW_DB_REF,'mkmkkkdserlcaycknuxp');
const origin=new URL(access.url).origin;
assert.match(origin,/^https:\/\/tcg-royal-[a-z0-9]+-collectorsrepublic\.vercel\.app$/);
const cookies=new Map();
function capture(response) {
 for(const cookie of response.headers.getSetCookie()){
  const pair=cookie.split(';')[0], at=pair.indexOf('='); cookies.set(pair.slice(0,at),pair.slice(at+1));
 }
}
const cookie=()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; ');
let url=access.url;
for(let redirects=0;redirects<6;redirects++){
 const r=await fetch(url,{redirect:'manual',headers:{Cookie:cookie()}});capture(r);
 if(r.status>=300&&r.status<400){url=new URL(r.headers.get('location'),url).href;assert.equal(new URL(url).origin,origin);continue;}
 assert.equal(r.status,200,'Preview share URL must resolve successfully');break;
}
const environment=await fetch(`${origin}/api/lending/environment`,{headers:{Cookie:cookie()}}).then(r=>r.json());
assert.equal(environment.environment,'preview');assert.equal(environment.supabaseRef,'mkmkkkdserlcaycknuxp');
const page=await fetch(`${origin}/lending`,{headers:{Cookie:cookie()}});assert.equal(page.status,200);assert.match(await page.text(),/TCG ROYAL Preview/);
const unauthorized=await fetch(`${origin}/api/lending/workflow`,{headers:{Cookie:cookie(),'x-lending-demo-role':'admin'}});
assert.equal(unauthorized.status,401);
const tokens={};
for(const role of ['customer','admin']){
 const r=await fetch(`${origin}/api/lending/session`,{method:'POST',headers:{Cookie:cookie(),Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code:fixtures.codes[role]})});
 assert.equal(r.status,200,`Cannot pair ${role}: ${await r.clone().text()}`);tokens[role]=(await r.json()).token;
}
const request=async(body,role='customer',expected=200,requestOrigin=origin)=>{
 const r=await fetch(`${origin}/api/lending/workflow`,{method:body?'POST':'GET',headers:{Cookie:cookie(),Authorization:`Bearer ${tokens[role]}`,Origin:requestOrigin,'Content-Type':'application/json','x-lending-demo-role':'admin'},body:body?JSON.stringify(body):undefined});
 const data=await r.json();assert.equal(r.status,expected,JSON.stringify(data));return data;
};
const state=await request();assert.equal(state.role,'customer');assert.equal(state.marketFixture,true);assert.equal(state.identityVerified,true);
await request({type:'quote',cardUid:fixtures.cardUid},'customer',403,'https://untrusted.example');
const {quote}=await request({type:'quote',cardUid:fixtures.cardUid});assert.equal(quote.cap_jpy,400000);
const cert=String(Date.now()).slice(-11);
const application={type:'apply',quoteId:quote.id,certInput:`https://www.psacard.com/cert/${cert}/psa`,amountJpy:300000,deposit:'mail',key:randomUUID()};
await request(application);await request(application);
let loan=(await request()).loans.find(l=>l.cert_number===cert);assert.ok(loan);
const loanId=loan.id;
const commands=[];
const command=async(action,payload={},role='customer',expected=200)=>{
 const body={type:'command',loanId,version:loan.version,key:randomUUID(),action,payload};
 await request(body,role,expected);loan=(await request()).loans.find(l=>l.id===loanId);
 if(expected===200)commands.push(action);
 return body;
};
await command('fund',{amountJpy:300000,reference:`PREVIEW-UNAUTHORIZED-${loanId}`},'customer',403);
await command('receive',{location:'PREVIEW-架空保管場所',certNumber:cert,inspected:true},'admin');
await command('offer',{amountJpy:300000,monthlyRateBps:200},'admin');assert.equal(loan.terms.principalJpy,300000);
await command('accept',{termsAccepted:false},'customer',409);await command('accept',{termsAccepted:true});
const funded=await command('fund',{amountJpy:300000,reference:`PREVIEW-FUND-${loanId}`},'admin');
await request(funded,'admin');assert.equal(loan.status,'active');assert.equal(loan.payoff_jpy,306000);assert.equal(loan.ledger.length,1);
await command('request_additional',{amountJpy:10000,termsAccepted:true});assert.equal(loan.principal_jpy,300000);
await command('reject_request',{},'admin');
const due=Date.parse(loan.due_at);await command('request_extension',{termsAccepted:true});
await command('extend',{amountJpy:18000,reference:`PREVIEW-EXTEND-${loanId}`},'admin');assert.ok(Date.parse(loan.due_at)>due);assert.equal(loan.payoff_jpy,300000);
await command('report_repayment');assert.equal(loan.principal_jpy,300000);
await command('reject_repayment',{reason:'架空の入金照合テスト'},'admin');
await command('report_repayment');
await command('confirm_repayment',{amountJpy:300001,reference:`PREVIEW-INVALID-${loanId}`},'admin',409);
await command('confirm_repayment',{amountJpy:300000,reference:`PREVIEW-REPAY-${loanId}`},'admin');assert.equal(loan.principal_jpy,0);
await command('return',{reference:`PREVIEW-RETURN-${loanId}`},'admin');assert.equal(loan.status,'returned');assert.equal(loan.events.length,14);
assert.equal(loan.storage_location,null);assert.ok(!('inspected_by' in loan));
const proof={testedAt:new Date().toISOString(),origin,dbRef:environment.supabaseRef,loanId,status:loan.status,commands,marketFixture:true,physicalDeviceTested:false};
writeFileSync('output/android/preview-verification.json',JSON.stringify(proof,null,2));
console.log('PASS: expiring Preview share URL → protection cookie → separate role sessions → API → selected hosted Preview DB → completed return.');
console.log('PASS: unsigned role forgery, cross-origin request, customer funding, missing consent, wrong repayment and duplicate retry checks.');
console.log('No physical device interaction or real payment was performed.');
