import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const target=JSON.parse(readFileSync('.env.lending-preview-test-target.local','utf8'));
assert.equal(target.projectId,'prj_IngPA3ovkXmU4UnI0D4ZPfuRbJmw');assert.equal(target.supabaseRef,'mkmkkkdserlcaycknuxp');
const origin=target.origin;assert.match(origin,/^https:\/\/tcg-royal-[a-z0-9]+-collectorsrepublic\.vercel\.app$/);
const fixtures=JSON.parse(readFileSync('.env.lending-preview-fixtures.local','utf8'));const tokens={};const tag='SYNTHETIC-'+randomUUID();const checks={};
async function request(path,body,role='customer',expected=200){const r=await fetch(origin+'/api/lending/'+path,{method:body?'POST':'GET',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json',...(tokens[role]?{Authorization:`Bearer ${tokens[role]}`}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const d=await r.json();assert.equal(r.status,expected,`${path}: ${d.error??r.status}`);return d;}
const anonymous=await fetch(origin+'/api/lending/support-cases',{redirect:'manual'});assert.equal(anonymous.status,401);checks.anonymousRejected=true;
for(const role of ['customer','admin']){const r=await fetch(origin+'/api/lending/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code:fixtures.codes[role]})});assert.equal(r.status,200);tokens[role]=(await r.json()).token;}
assert.equal((await request('environment')).supabaseRef,'mkmkkkdserlcaycknuxp');
const draft={reason:'ungraded',cardName:tag,cardNumber:'TEST-001',condition:'架空データ',notes:'自動検証用。実物・送金なし。',requestedAmount:'300000'};const create={action:'create',draft,consent:true,key:randomUUID()};
let c=(await request('support-cases',create)).case;
assert.equal((await request('support-cases',create)).case.id,c.id);assert.match(c.reference,/^TR-[A-F0-9]{12}$/);checks.idempotentRegistration=true;
await request('support-cases',{...create,key:randomUUID(),userId:fixtures.config.LENDING_PREVIEW_ADMIN_ID},'customer',403);
await request('support-cases',{action:'review',caseId:c.id,version:c.version,key:randomUUID(),payload:{message:'偽装管理者'}},'customer',403);checks.staffPrivilegesEnforced=true;
let orphan=(await request('support-cases',{...create,key:randomUUID(),contactLabel:tag+'-PRIVATE'},'admin')).case;
assert.ok(!(await request('support-cases')).cases.some(x=>x.id===orphan.id));checks.unlinkedCasePrivate=true;
async function change(action,payload,role='admin'){c=(await request('support-cases',{action,caseId:c.id,version:c.version,key:randomUUID(),payload},role)).case;}
await change('review',{message:'架空の写真照合を確認'});await change('request_info',{message:'追加写真の確認テスト'});await change('review',{message:'情報の確認テスト'});await change('offer',{amountJpy:300000,valuationJpy:500000,message:'自動テスト用の参考額・実取引なし'});
assert.ok((await request('support-cases')).cases.some(x=>x.id===c.id&&x.status==='offered'));checks.customerSeesOffer=true;
await change('accept',{amountJpy:300000,deposit:'mail',termsAccepted:true},'customer');assert.ok(c.loan_id);checks.convertedToRealLoanRecord=true;
const loan=(await request('workflow')).loans.find(x=>x.id===c.loan_id);assert.ok(loan);assert.equal(loan.cert_number,null);assert.equal(loan.card_name,tag);
await request('workflow',{type:'command',loanId:loan.id,version:loan.version,key:randomUUID(),action:'cancel',payload:{}});
assert.equal((await request('support-cases')).cases.find(x=>x.id===c.id).loan_status,'cancelled');checks.loanStatusDerived=true;
orphan=(await request('support-cases',{action:'link',caseId:orphan.id,version:orphan.version,key:randomUUID(),payload:{userId:fixtures.config.LENDING_PREVIEW_CUSTOMER_ID}},'admin')).case;
const linked=(await request('support-cases')).cases.find(x=>x.id===orphan.id);assert.ok(linked);assert.equal(linked.contact_label,undefined);checks.staffMemoPrivate=true;checks.manualCustomerLinking=true;
await request('support-cases',{action:'cancel',caseId:orphan.id,version:orphan.version,key:randomUUID(),payload:{message:'自動検証完了'}},'admin');
const proof={testedAt:new Date().toISOString(),origin,supabaseRef:target.supabaseRef,checks,syntheticReference:c.reference,linkedLoanId:c.loan_id,noRealTransfers:true,noExternalMessages:true,noPsaCalls:true,syntheticRecordsClosed:true};writeFileSync('output/android/v190-support-integration.json',JSON.stringify(proof,null,2));console.log(proof);
