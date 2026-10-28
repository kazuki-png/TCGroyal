// Opt-in hosted Preview test. Uses a clearly marked manual label and live
// Snkrdunk pricing; never represents the manual label as a PSA API result.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
if(process.env.RUN_LENDING_PREVIEW_TEST!=='1')throw Error('Explicit Preview test opt-in required');
const fixtures=JSON.parse(readFileSync('.env.lending-preview-fixtures.local','utf8'));
const access=JSON.parse(readFileSync('.env.lending-preview-access.local','utf8'));
assert.equal(fixtures.config.LENDING_PREVIEW_DB_REF,'mkmkkkdserlcaycknuxp');
const origin=new URL(access.url).origin;assert.match(origin,/^https:\/\/tcg-royal-[a-z0-9]+-collectorsrepublic\.vercel\.app$/);
const cookies=new Map();let url=access.url;
const cookie=()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; ');
for(let i=0;i<6;i++){
 const r=await fetch(url,{redirect:'manual',headers:{Cookie:cookie()}});
 for(const value of r.headers.getSetCookie()){const pair=value.split(';')[0],at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1))}
 if(r.status>=300&&r.status<400){url=new URL(r.headers.get('location'),url).href;assert.equal(new URL(url).origin,origin);continue}
 assert.equal(r.status,200);break;
}
const tokens={};
for(const role of ['customer','admin']){
 const r=await fetch(`${origin}/api/lending/session`,{method:'POST',headers:{Cookie:cookie(),Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code:fixtures.codes[role]})});assert.equal(r.status,200);tokens[role]=(await r.json()).token;
}
const request=async(path,body,role='customer',status=200)=>{
 const r=await fetch(`${origin}/api/lending/${path}`,{method:body?'POST':'GET',headers:{Cookie:cookie(),Authorization:`Bearer ${tokens[role]}`,Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await r.json();assert.equal(r.status,status,`${path}: ${JSON.stringify(data)}`);return data;
};
const environment=await request('environment');assert.equal(environment.supabaseRef,'mkmkkkdserlcaycknuxp');
const account=await request('account');assert.equal(account.capabilities.documentUploadEnabled,true);assert.equal(account.capabilities.jpkiConfigured,false);
assert.equal(typeof account.summary.outstandingJpy,'number');assert.ok('nextDueAt' in account.summary);
const initialLoanCount=(await request('workflow')).loanCount;
if(!account.capabilities.psaConfigured){const failed=await request('cards',{action:'lookup',certInput:'167034272'},'customer',502);assert.match(failed.error,/接続設定/)}
await request('identity',{action:'start',verified:true},'customer',503);
await request('documents',{verified:true},'customer',400);
const phoneConfig=await request('phone');assert.equal(phoneConfig.enabled,false);
await request('phone',{idToken:'synthetic.invalid.token'},'customer',503);
await request('reviews',null,'customer',403);
if(!account.capabilities.remotePushConfigured)await request('notifications',{action:'register',token:'synthetic-fcm-token-for-config-check',platform:'android'},'customer',503);
const lookup=await request('cards',{action:'manual_lookup',certInput:'99000000101',subject:'PIKACHU ex',cardNumber:'132',brand:'pokemon',grade:'10',unverifiedConfirmed:true});
assert.equal(lookup.certificate.verifiedBy,'user_entered');
assert.ok(lookup.candidates.some(p=>p.productId==='408333'),'Live search should find the expected product candidate');
const result=await request('cards',{action:'assess',lookupId:lookup.id,productId:'408333',confirmed:true});
assert.equal(result.quote,null);assert.equal(result.requiresReview,true);assert.ok(result.assessment.estimate_jpy>0);
assert.ok(Date.now()-Date.parse(result.market.fetchedAt)<300000);
await request('cards',{action:'request',assessmentId:result.assessment.id,consent:true});
const mine=await request('account');assert.equal(mine.assessments.find(a=>a.id===result.assessment.id).status,'submitted');
const admin=await request('reviews',null,'admin');assert.ok(admin.assessments.some(a=>a.id===result.assessment.id));
assert.equal((await request('workflow')).loanCount,initialLoanCount,'Manual label must not create a funded loan/application');
await request('cards',{action:'cancel',assessmentId:result.assessment.id});
const uploaded=[];
try{
 const image=await sharp({create:{width:600,height:360,channels:3,background:'#ffefc2'}}).composite([{input:Buffer.from('<svg width="600" height="360"><text x="30" y="170" font-size="32">SYNTHETIC TEST ONLY</text></svg>')}]).jpeg().toBuffer();
 for(const side of ['front','back']){
  const form=new FormData();form.append('documentType','drivers_license');form.append('side',side);form.append('consent','true');form.append('file',new Blob([image],{type:'image/jpeg'}),'synthetic-license.jpg');
  const r=await fetch(`${origin}/api/lending/documents`,{method:'POST',headers:{Cookie:cookie(),Authorization:`Bearer ${tokens.customer}`,Origin:origin},body:form});
  assert.equal(r.status,200);const doc=await r.json();uploaded.push(doc.id);
  const inbox=await request('reviews',null,'admin');assert.ok(inbox.documents.some(d=>d.id===doc.id));
  const signed=await request(`reviews?documentId=${doc.id}`,null,'admin');assert.equal(new URL(signed.url).origin,'https://mkmkkkdserlcaycknuxp.supabase.co');
  const photo=await fetch(signed.url);assert.equal(photo.status,200);assert.match(photo.headers.get('content-type'),/image\/jpeg/);
  await request('reviews',{documentId:doc.id,approve:true,testOnlyConfirmed:true},'admin');
  const state=await request('account');assert.equal(state.identity.status,side==='front'?'unverified':'test_verified');
 }
}finally{
 for(const id of uploaded){
  const r=await fetch(`${origin}/api/lending/documents?id=${id}`,{method:'DELETE',headers:{Cookie:cookie(),Authorization:`Bearer ${tokens.customer}`,Origin:origin}});assert.equal(r.status,200);
 }
}
assert.equal((await request('account')).identity.status,'unverified');
const proof={testedAt:new Date().toISOString(),origin,dbRef:environment.supabaseRef,liveSnkrdunkSearch:true,liveSnkrdunkPrice:true,
 manualLabelNeverTreatedAsPsaVerified:true,assessmentRequestVisibleToOwnerAndAdmin:true,licenseFrontBackUploadReviewAndDelete:true,firebaseUnconfiguredFailsClosed:true,
 jpkiNotConfigured:true,psaConfigured:account.capabilities.psaConfigured,remotePushConfigured:account.capabilities.remotePushConfigured,physicalDeviceTested:false};
writeFileSync('output/android/mobile-preview-verification.json',JSON.stringify(proof,null,2));
console.log('PASS: live Snkrdunk search and PSA10 market fetch → derived estimate → explicit manual review request → customer account → admin inbox → cancellation.');
console.log('PASS: private license front/back upload → audited signed image view → approval requires both sides → deletion expires identity.');
console.log('PASS: account aggregates, customer/admin separation, fail-closed Firebase/JPKI and missing-credential errors.');
console.log('PSA auto-lookup, Firebase phone SMS and remote push require provider configuration; no delivery success was fabricated.');
