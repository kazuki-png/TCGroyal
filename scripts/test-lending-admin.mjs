import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {startLocalApp} from './lending-local-runtime.mjs';
let app;
try{
 app=await startLocalApp();console.log(app.sql(readFileSync('__tests__/database/lending-admin.sql','utf8')));
 console.log(app.sql(readFileSync('__tests__/database/lending-admin-roles.sql','utf8')));
 const request=async(path,body,role='admin',expected=200,origin=app.origin)=>{
  const r=await fetch(app.origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'x-lending-demo-role':role,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));return d;
 };
 const overview=await request('/api/admin/lending');assert.equal(overview.total,62);assert.equal(overview.summary.outstandingJpy,5800000);
 await request('/api/admin/lending',null,'customer',403);
 await request('/api/admin/lending',{kind:'case'},'admin',403,'https://evil.invalid');
 const created=await request('/api/admin/lending',{kind:'case',action:'create',key:randomUUID(),consent:true,draft:{reason:'ungraded',cardName:'HTTP管理受付',cardNumber:'1',condition:'未鑑定',notes:'架空テスト',requestedAmount:''}});
 const c=created.case;assert.ok(c.reference);const detail=await request('/api/admin/lending?kind=case&id='+c.id);assert.equal(detail.item.card_name,'HTTP管理受付');assert.equal(detail.customer,null);
 await request('/api/admin/lending',{kind:'case',action:'review',caseId:c.id,version:c.version,key:randomUUID(),payload:{message:'写真を確認中'}});
 // Reproduce the admin receive form against the real API and database, without external services.
 const customer='10000000-0000-4000-8000-000000000001';
 const intake=(await request('/api/admin/lending',{kind:'case',action:'create',key:randomUUID(),userId:customer,consent:true,draft:{reason:'ungraded',cardName:'検品API確認',cardNumber:'2',condition:'未鑑定',notes:'架空テスト',requestedAmount:'100000'}})).case;
 await request('/api/admin/lending',{kind:'case',action:'review',caseId:intake.id,version:1,key:randomUUID(),payload:{message:'写真確認'}});
 await request('/api/admin/lending',{kind:'case',action:'offer',caseId:intake.id,version:2,key:randomUUID(),payload:{amountJpy:100000,valuationJpy:200000,message:'現物確認前の見積もり'}});
 const accepted=await request('/api/lending/support-cases',{action:'accept',caseId:intake.id,version:3,key:randomUUID(),payload:{amountJpy:100000,deposit:'mail',termsAccepted:true}},'customer');
 const loanId=accepted.case.loan_id;
 const receive=payload=>({kind:'loan',type:'command',loanId,version:1,key:randomUUID(),action:'receive',payload});
 const invalid=await request('/api/admin/lending',receive({location:' ',inspected:true}),'admin',400);assert.match(invalid.error,/保管場所/);
 const unchecked=await request('/api/admin/lending',receive({location:'金庫A',inspected:false}),'admin',400);assert.match(unchecked.error,/検品確認/);
 let inspected=await request('/api/admin/lending?kind=loan&id='+loanId);assert.equal(inspected.item.status,'submitted');assert.equal(inspected.item.version,1);
 await request('/api/admin/lending',receive({location:'金庫A',inspected:true}));
 inspected=await request('/api/admin/lending?kind=loan&id='+loanId);assert.equal(inspected.item.status,'received');assert.equal(inspected.item.storage_location,'金庫A');assert.equal(inspected.item.version,2);
 console.log('Inspection validation rejects missing storage/confirmation without changing the loan, then records an uncertified card successfully.');
 const retired=await fetch(app.origin+'/api/admin/lending/preview',{method:'POST'});assert.equal(retired.status,410);
 console.log('Admin overview → manual creation → detail → status update passed; customer/cross-origin rejection and retired price endpoint passed.');
}catch(e){console.error(e.stderr||e.message);if(app)console.error(app.logs());process.exitCode=1;}finally{await app?.stop();}
