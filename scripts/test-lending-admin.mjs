import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {startLocalApp} from './lending-local-runtime.mjs';
let app;
try{
 app=await startLocalApp();console.log(app.sql(readFileSync('__tests__/database/lending-admin.sql','utf8')));
 const request=async(path,body,role='admin',expected=200,origin=app.origin)=>{
  const r=await fetch(app.origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'x-lending-demo-role':role,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));return d;
 };
 const overview=await request('/api/admin/lending');assert.equal(overview.total,61);assert.equal(overview.summary.outstandingJpy,5800000);
 await request('/api/admin/lending',null,'customer',403);
 await request('/api/admin/lending',{kind:'case'},'admin',403,'https://evil.invalid');
 const created=await request('/api/admin/lending',{kind:'case',action:'create',key:randomUUID(),consent:true,draft:{reason:'ungraded',cardName:'HTTP管理受付',cardNumber:'1',condition:'未鑑定',notes:'架空テスト',requestedAmount:''}});
 const c=created.case;assert.ok(c.reference);const detail=await request('/api/admin/lending?kind=case&id='+c.id);assert.equal(detail.item.card_name,'HTTP管理受付');assert.equal(detail.customer,null);
 await request('/api/admin/lending',{kind:'case',action:'review',caseId:c.id,version:c.version,key:randomUUID(),payload:{message:'写真を確認中'}});
 const retired=await fetch(app.origin+'/api/admin/lending/preview',{method:'POST'});assert.equal(retired.status,410);
 console.log('Admin overview → manual creation → detail → status update passed; customer/cross-origin rejection and retired price endpoint passed.');
}catch(e){console.error(e.stderr||e.message);if(app)console.error(app.logs());process.exitCode=1;}finally{await app?.stop();}
