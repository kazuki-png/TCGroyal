// Opt-in PSA live integration test. Provider token stays inside Vercel.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
if(process.env.RUN_LENDING_PREVIEW_TEST!=='1'&&!process.argv.includes('--run-preview'))throw Error('Explicit Preview opt-in required');
let target={};try{target=JSON.parse(readFileSync('.env.lending-preview-test-target.local','utf8'))}catch{}
const fixtures=JSON.parse(readFileSync('.env.lending-preview-fixtures.local','utf8'));
assert.equal(fixtures.config.LENDING_PREVIEW_DB_REF,'mkmkkkdserlcaycknuxp');
const origin=process.env.LENDING_TEST_PREVIEW_ORIGIN??target.origin;
assert.match(origin??'',/^https:\/\/tcg-royal-[a-z0-9]+-collectorsrepublic\.vercel\.app$/);
const deployment=process.env.LENDING_TEST_PREVIEW_DEPLOYMENT??target.deployment;
assert.match(deployment??'',/^dpl_[A-Za-z0-9]+$/);
if(process.argv.includes('--diagnostics-only')){
 const result=spawnSync('C:/nvm4w/nodejs/node.exe',['C:/nvm4w/nodejs/node_modules/vercel/dist/vc.js','logs',deployment,'--no-follow','--since','15m','--expand','--limit','10','--scope','collectorsrepublic'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
 assert.equal(result.status,0,'Could not retrieve Preview logs');const logs=result.stdout+result.stderr;
 writeFileSync('.env.lending-preview-psa-logs.local',logs);
 const index=logs.indexOf('PSA API response rejected');
 console.log({diagnosticFound:index>=0,upstreamResponseTypes:index>=0?logs.slice(index,index+350).match(/(?:application|text)\/[a-z0-9.+-]+/gi)??[]:[]});process.exit(0);
}
let access;
try{const previous=JSON.parse(readFileSync('.env.lending-preview-access.local','utf8'));if(new URL(previous.url).origin===origin&&previous.expires>Date.now()/1000+900)access=previous}catch{}
if(!access){
const requestFile='.env.lending-preview-share-request.local';
writeFileSync(requestFile,JSON.stringify({ttl:82800}));
const raw=execFileSync('C:/nvm4w/nodejs/node.exe',['C:/nvm4w/nodejs/node_modules/vercel/dist/vc.js','api',
 `/aliases/${deployment}/protection-bypass?teamId=team_qlcIfEtZbuo5fulR7nGRTZ1M`,'--method','PATCH','--input',requestFile,'--scope','collectorsrepublic'],
 {encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
writeFileSync('.env.lending-preview-share-response.local',raw);
const entry=Object.entries(JSON.parse(raw).protectionBypass).find(([,v])=>v.scope==='shareable-link');
assert.ok(entry);
access={url:`${origin}/lending?_vercel_share=${entry[0]}`,expires:entry[1].expires};
writeFileSync('.env.lending-preview-access.local',JSON.stringify(access,null,2));
}
const cookies=new Map();const cookie=()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; ');
let url=access.url,ready=false;
for(let i=0;i<12;i++){
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Cookie:cookie()}});
 for(const value of r.headers.getSetCookie()){const pair=value.split(';')[0],at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1))}
 if(r.status>=300&&r.status<400){const next=new URL(r.headers.get('location'),url);if(next.origin==='https://vercel.com'){await new Promise(resolve=>setTimeout(resolve,5000));url=access.url;continue}assert.equal(next.origin,origin);url=next.href;continue}
 assert.equal(r.status,200);ready=true;break;
}
assert.ok(ready,'Share link has not propagated; no business credentials sent');
const login=await fetch(`${origin}/api/lending/session`,{method:'POST',headers:{Cookie:cookie(),Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code:fixtures.codes.customer})});
assert.equal(login.status,200);const session=await login.json();
const request=async(path,body,expectedStatus=200)=>{
 const r=await fetch(`${origin}/api/lending/${path}`,{method:body?'POST':'GET',signal:AbortSignal.timeout(45000),headers:{Cookie:cookie(),Authorization:`Bearer ${session.token}`,Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await r.json();assert.equal(r.status,expectedStatus,`${path}: ${JSON.stringify(data)}`);return data;
};
assert.equal((await request('environment')).supabaseRef,'mkmkkkdserlcaycknuxp');
const account=await request('account');assert.equal(account.capabilities.psaConfigured,true);
if(process.argv.includes('--firebase-configuration')){
 const config=await request('phone');
 const native=JSON.parse(readFileSync('mobile/google-services.json','utf8'));
 assert.equal(config.enabled,true);assert.equal(config.projectId,native.project_info.project_id);
 assert.equal(account.capabilities.phoneConfigured,true);assert.equal(account.capabilities.remotePushConfigured,true);
 await request('phone',{idToken:'invalid.not-a-real.firebase-token'},401);
 const proof={testedAt:new Date().toISOString(),origin,firebaseProjectId:config.projectId,nativeAndServerMatch:true,phoneConfigured:true,remotePushConfigured:true,invalidIdTokenRejected:true,smsDelivered:false,pushDelivered:false,physicalDeviceTested:false};
 writeFileSync('output/android/firebase-preview-verification.json',JSON.stringify(proof,null,2));console.log(proof);process.exit(0);
}
if(process.argv.includes('--configuration-only')){console.log('PASS: protected Preview session, selected Preview database and configured PSA secret. No PSA request sent.');process.exit(0)}
const lookup=await request('cards',{action:'lookup',certInput:'167034272'});
assert.equal(lookup.certificate.verifiedBy,'psa_api');assert.equal(lookup.certificate.certNumber,'167034272');
const proof={testedAt:new Date().toISOString(),origin,certificate:lookup.certificate,candidates:lookup.candidates,searchWarning:lookup.searchWarning??null};
if(process.env.LENDING_TEST_PRODUCT_ID){
 const product=lookup.candidates.find(c=>c.productId===process.env.LENDING_TEST_PRODUCT_ID);
 assert.ok(product,'Chosen product must appear in this real PSA search');
 const result=await request('cards',{action:'assess',lookupId:lookup.id,productId:product.productId,confirmed:true});
 proof.assessment={id:result.assessment.id,product:result.assessment.product,estimateJpy:result.assessment.estimate_jpy,market:result.market,requiresReview:result.requiresReview};
 assert.ok(result.assessment.estimate_jpy>0);
}
writeFileSync('output/android/psa-preview-verification.json',JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof,null,2));
