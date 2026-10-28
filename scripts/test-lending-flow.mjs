import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startLocalApp,fixtureIds } from './lending-local-runtime.mjs';
let runtime;
try {
 runtime=await startLocalApp();const origin=runtime.origin;
 const get=async role=>{const r=await fetch(`${origin}/api/lending/workflow`,{headers:{'x-lending-demo-role':role}});assert.equal(r.status,200);return r.json();};
 const post=async(body,role='customer',expected=200,requestOrigin=origin)=>{
  const r=await fetch(`${origin}/api/lending/workflow`,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json','x-lending-demo-role':role},body:JSON.stringify(body)});
  const data=await r.json();assert.equal(r.status,expected,JSON.stringify(data));return data;
 };
 const page=await fetch(`${origin}/lending`);assert.equal(page.status,200);assert.match(await page.text(),/TCG ROYAL/);
 assert.equal((await get('customer')).loans.length,0);
 await post({type:'quote',cardUid:fixtureIds.card},'customer',403,'https://evil.example');
 await post({type:'quote',cardUid:fixtureIds.card,price:999999},'customer',400);
 const {quote}=await post({type:'quote',cardUid:fixtureIds.card});assert.equal(quote.cap_jpy,400000);
 const apply={type:'apply',quoteId:quote.id,certInput:'https://www.psacard.com/cert/88880001/psa',amountJpy:300000,deposit:'mail',key:randomUUID()};
 await post(apply);await post(apply);assert.equal((await get('customer')).loans.length,1);
 let loan=(await get('customer')).loans[0];
 const command=async(action,payload,role='customer',expected=200)=>{
  const body={type:'command',loanId:loan.id,version:loan.version,key:randomUUID(),action,payload};
  const result=await post(body,role,expected);
  loan=(await get('customer')).loans.find(l=>l.id===loan.id);
  return {body,result};
 };
 await command('fund',{amountJpy:300000,reference:'fake-customer-fund'},'customer',403);
 await command('receive',{location:'金庫A-01',certNumber:'88880001',inspected:true},'admin');assert.equal(loan.status,'received');
 await command('offer',{amountJpy:300000,monthlyRateBps:200},'admin');assert.equal(loan.status,'offered');
 assert.equal(loan.terms.principalJpy,300000);assert.ok(loan.terms.assessmentQuoteId);
 await command('accept',{termsAccepted:false},'customer',409);
 await command('accept',{termsAccepted:true});assert.equal(loan.status,'accepted');
 const funded=await command('fund',{amountJpy:300000,reference:'FLOW-FUND-0001'},'admin');
 await post(funded.body,'admin'); // network retry does not add a second ledger entry
 assert.equal(loan.status,'active');assert.equal(loan.payoff_jpy,306000);assert.equal(loan.ledger.length,1);
 await command('request_additional',{amountJpy:10000,termsAccepted:true});assert.equal(loan.principal_jpy,300000);
 await command('reject_request',{},'admin');
 const originalDue=Date.parse(loan.due_at);
 await command('request_extension',{termsAccepted:true});assert.equal(Date.parse(loan.due_at),originalDue);
 await command('extend',{amountJpy:18000,reference:'FLOW-EXTEND-0001'},'admin');
 assert.ok(Date.parse(loan.due_at)>originalDue);assert.equal(loan.payoff_jpy,300000);
 await command('report_repayment',{});assert.equal(loan.principal_jpy,300000);assert.equal(loan.status,'repayment_pending');
 await command('reject_repayment',{reason:'テスト明細では入金を確認できません'},'admin');assert.equal(loan.status,'active');
 await command('report_repayment',{});assert.equal(loan.principal_jpy,300000);
 await command('confirm_repayment',{amountJpy:300001,reference:'FLOW-REPAY-WRONG'},'admin',409);
 await command('confirm_repayment',{amountJpy:300000,reference:'FLOW-REPAY-0001'},'admin');
 assert.equal(loan.status,'return_pending');assert.equal(loan.principal_jpy,0);
 await command('return',{reference:'FLOW-RETURN-0001'},'admin');assert.equal(loan.status,'returned');
 assert.deepEqual(loan.ledger.map(e=>e.kind).sort(),['disbursement','extension_interest','repayment'].sort());
 assert.equal(loan.events.length,14);
 assert.ok(!('inspected_by' in loan));assert.equal(loan.storage_location,null);
 assert.equal(runtime.sql('SELECT count(*) FROM lending_quotes').trim(),'2');
 // Synthetic cached evidence in the isolated DB only. No PSA or market calls.
 const cachedCert={verifiedBy:'psa_api',certNumber:'991000001',specId:null,year:'2024',brand:'LOCAL SYNTHETIC TEST',category:'TCG CARDS',cardNumber:'TEST-001',subject:'LOCAL SYNTHETIC CACHE',variety:'TEST ONLY',grade:'9',gradeDescription:'MINT 9',eligible:false,sourceUrl:'https://www.psacard.com/cert/991000001/psa',fetchedAt:new Date().toISOString()};
 runtime.sql(`INSERT INTO lending_certificate_lookups(user_id,cert_number,certificate) VALUES('${fixtureIds.customer}','991000001','${JSON.stringify(cachedCert)}'::jsonb);`);
 const lookup=async role=>{
  const r=await fetch(`${origin}/api/lending/cards`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-lending-demo-role':role},body:JSON.stringify({action:'lookup',certInput:'991000001'})});return {status:r.status,data:await r.json()};
 };
 const cached=await lookup('customer');assert.equal(cached.status,200);assert.equal(cached.data.cacheHit,true);assert.equal(cached.data.certificate.eligible,false);
 assert.equal(cached.data.certificate.fetchedAt,cachedCert.fetchedAt);
 const foreign=await lookup('admin');assert.equal(foreign.status,502);assert.match(foreign.data.error,/接続設定/);
 runtime.sql(`UPDATE lending_certificate_lookups SET expires_at=now()-interval '1 second' WHERE cert_number='991000001';`);
 const expired=await lookup('customer');assert.equal(expired.status,502);assert.match(expired.data.error,/接続設定/);
 assert.equal(runtime.sql("SELECT count(*) FROM lending_certificate_lookups WHERE cert_number='991000001'").trim(),'1');
 console.log('PASS: browser page → Next.js API → local PostgREST → PostgreSQL → scoped response');
 console.log('Browser JavaScript interaction and device camera require separate verification.');
 console.log('PASS: quote, QR URL, duplicate retry, permissions, inspection, revaluation, consent, funding, additional request, extension, repayment, return');
 console.log('PASS: PSA cache → owner-only reuse → original fetch time → foreign account rejection → expiry, without external provider calls');
 console.log(`Local preview: ${origin}/lending`);
 if(process.env.KEEP_LENDING_LOCAL==='true') {
  console.log('Keeping isolated preview open for visual verification. Ctrl+C stops this session.');
  await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
 }
} catch(error) { console.error(error.stderr?.toString()||error.stack||error.message);if(runtime)console.error(runtime.logs());process.exitCode=1; }
finally {await runtime?.stop();}
