import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {startLocalApp,fixtureIds} from './lending-local-runtime.mjs';
let app;
try{
 app=await startLocalApp();console.log(app.sql(readFileSync('__tests__/database/lending-catalog.sql','utf8')));
 const post=async(body,role='customer',expected=200,origin=app.origin)=>{
  const r=await fetch(app.origin+'/api/lending/catalog',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'x-lending-demo-role':role},body:JSON.stringify(body)});
  const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));return d;
 };
 const search=await post({action:'search',query:'TEST-001',category:'pokemon',page:1});assert.equal(search.cards.length,1);assert.equal(search.cards[0].public_uid,fixtureIds.card);
 await post({action:'search',page:0},'customer',400);await post({action:'search'},'customer',403,'https://evil.invalid');
 const result=await post({action:'assess',cardUid:fixtureIds.card,declaredGrade:'PSA10'});assert.equal(result.assessment.indicative_jpy,400000);assert.equal(result.assessment.cert_number,null);
 const body={action:'submit',assessmentId:result.assessment.id,requestedAmount:'300000',notes:'Synthetic catalog flow',consent:true,key:randomUUID()};
 const registered=await post(body);assert.equal((await post(body)).case.id,registered.case.id);assert.equal(registered.case.card_uid,fixtureIds.card);
 const r=await fetch(app.origin+'/api/lending/support-cases');const cases=(await r.json()).cases;assert.ok(cases.some(c=>c.id===registered.case.id&&c.selected_card.name==='ローカル検証カード'));
 const manual=await post({action:'assess',cardUid:fixtureIds.card,declaredGrade:'ungraded'});assert.equal(manual.assessment.indicative_jpy,null);
 const image=await fetch(app.origin+'/api/lending/card-image',{method:'POST',headers:{Origin:app.origin}});assert.equal(image.status,503);
 console.log('Catalog DB search → PSA-free assessment → persisted case → listing passed; ungraded and unconfigured image fallback passed. No external APIs called.');
}catch(e){console.error(e.stderr||e.message);if(app)console.error(app.logs());process.exitCode=1;}finally{await app?.stop();}
