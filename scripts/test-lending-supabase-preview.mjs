import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const runtime = JSON.parse(readFileSync('.env.lending-preview-runtime.local','utf8'));
assert.equal(runtime.LENDING_PREVIEW_DB_REF,'mkmkkkdserlcaycknuxp');
assert.equal(runtime.LENDING_PREVIEW_SUPABASE_URL,'https://mkmkkkdserlcaycknuxp.supabase.co');
const key = readFileSync('tmp/.lending-auth-public-key.local','utf8').trim(); assert.ok(key.startsWith('sb_publishable_'));
const authUrl = runtime.LENDING_PREVIEW_SUPABASE_URL;
const admin = createClient(authUrl,runtime.LENDING_PREVIEW_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const target = JSON.parse(readFileSync('.env.lending-preview-test-target.local','utf8'));
assert.equal(target.origin,'https://tcg-royal-9a2agk48s-collectorsrepublic.vercel.app');
const access = JSON.parse(readFileSync('.env.lending-preview-access.local','utf8')); assert.equal(new URL(access.url).origin,target.origin);
const runId = randomUUID(); const users = []; const cookies = new Map();
const withoutVercelCookie = process.argv.includes('--without-vercel-cookie');
let step = 'bootstrap'; const checks = {};
const cookie = () => [...cookies].map(([k,v])=>`${k}=${v}`).join('; ');
async function api(path,token,body,status=200) {
 const response = await fetch(`${target.origin}/api/lending/${path}`,{method:body?'POST':'GET',redirect:'manual',signal:AbortSignal.timeout(30000),headers:{Origin:target.origin,Cookie:cookie(),'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
 assert.equal(response.status,status,`${step}: unexpected response status ${response.status}`);
 assert.ok(response.headers.get('content-type')?.includes('json'),`${step}: expected JSON`); return response.json();
}
try {
 let url = access.url;
 for(let i=0;!withoutVercelCookie&&i<5;i++) {
  const r=await fetch(url,{redirect:'manual',headers:{Cookie:cookie()},signal:AbortSignal.timeout(20000)});
  for(const line of r.headers.getSetCookie()){const pair=line.split(';')[0],at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1));}
  if(r.status>=300&&r.status<400){const next=new URL(r.headers.get('location'),url);assert.equal(next.origin,target.origin);url=next.href;continue;}
  assert.equal(r.status,200);break;
 }
 step='synthetic accounts';
 for(let index=0;index<2;index++) {
  const email=`lending-auth-synthetic-${runId}-${index}@example.invalid`,password=randomBytes(32).toString('hex');
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{lending_auth_smoke:runId,role:'admin'}});
  assert.equal(created.error,null,'Synthetic account creation failed'); assert.ok(created.data.user);
  const fixture={id:created.data.user.id,email,password,client:createClient(authUrl,key,{auth:{persistSession:false,autoRefreshToken:false}}),token:null};users.push(fixture);
  const login=await fixture.client.auth.signInWithPassword({email,password}); assert.equal(login.error,null,'Password login failed');assert.ok(login.data.session);
  fixture.token=login.data.session.access_token;
 }
 checks.passwordLogin=true;
 step='authenticated API';
 const first=await api('account',users[0].token);const second=await api('account',users[1].token);
 assert.equal(first.authentication.email,users[0].email);assert.equal(second.authentication.email,users[1].email);
 assert.equal(first.authentication.provider,'supabase'); assert.equal(first.capabilities.phoneConfigured,false);
 checks.userIdentityBinding=true;
 step='role isolation'; const workflow=await api('workflow',users[0].token);assert.equal(workflow.role,'customer');assert.equal(workflow.demo,false);
 await api('workflow',users[0].token,{type:'verify_mapping',cardUid:'10000000-0000-4000-8000-000000000001',productId:'408333',verified:true},403);
 checks.editableAdminMetadataRejected=true;
 step='owner profile update';
 await api('account',users[0].token,{...first.profile,last_name:'SYNTHETIC',first_name:'TEST',last_name_kana:'テスト',first_name_kana:'テスト',birthday:'2000-01-01',postal_code:'1000000',address:'SYNTHETIC TEST ADDRESS',phone:'09000000000'});
 const afterA=await api('account',users[0].token),afterB=await api('account',users[1].token);
 assert.equal(afterA.profile.last_name,'SYNTHETIC');assert.equal(afterB.profile.last_name,second.profile.last_name);
 const direct=await users[0].client.from('profiles').select('id').eq('id',users[1].id);assert.ok(direct.error||direct.data.length===0);
 const deniedRpc=await users[0].client.rpc('lending_list',{p_actor:users[1].id});assert.ok(deniedRpc.error);
 checks.ownerIsolation=true;checks.directBusinessRpcDenied=true;
 step='invalid tokens';await api('account',null,undefined,401);
 const parts=users[0].token.split('.');parts[2]=(parts[2][0]==='a'?'b':'a')+parts[2].slice(1);await api('account',parts.join('.'),undefined,401);
 checks.invalidBearerRejected=true;
 if (withoutVercelCookie) {
  step='recovery password update';
  // generateLink returns a synthetic recovery token without sending an email.
  const link=await admin.auth.admin.generateLink({type:'recovery',email:users[0].email});
  assert.equal(link.error,null);assert.ok(link.data.properties.hashed_token);
  const recovered=await users[0].client.auth.verifyOtp({type:'recovery',token_hash:link.data.properties.hashed_token});
  assert.equal(recovered.error,null);assert.ok(recovered.data.session);
  const nextPassword=randomBytes(32).toString('hex');
  assert.equal((await users[0].client.auth.updateUser({password:nextPassword})).error,null);
  assert.equal((await users[0].client.auth.signOut({scope:'local'})).error,null);
  const oldLogin=await users[0].client.auth.signInWithPassword({email:users[0].email,password:users[0].password});assert.ok(oldLogin.error);
  const newLogin=await users[0].client.auth.signInWithPassword({email:users[0].email,password:nextPassword});assert.equal(newLogin.error,null);
  users[0].token=newLogin.data.session.access_token;await api('account',users[0].token);
  checks.recoveryPasswordUpdate=true;checks.oldPasswordRejected=true;checks.newPasswordLogin=true;checks.noVercelCookie=true;
 }
 step='refresh and logout';const refreshed=await users[0].client.auth.refreshSession();assert.equal(refreshed.error,null);assert.ok(refreshed.data.session);
 users[0].token=refreshed.data.session.access_token;await api('account',users[0].token);
 const refreshToken=refreshed.data.session.refresh_token;
 const logout=await users[0].client.auth.signOut({scope:'local'});assert.equal(logout.error,null);
 const rejectedRefresh=await users[0].client.auth.refreshSession({refresh_token:refreshToken});assert.ok(rejectedRefresh.error);
 checks.refreshAndLogout=true;
 console.log({supabaseRef:'mkmkkkdserlcaycknuxp',checks});
} catch(error) { console.error('Supabase auth integration failed at step:',step,'reason:',error instanceof Error?error.message:'unknown');process.exitCode=1; }
finally {
 let cleaned=0;
 for(const fixture of users) {
  await fixture.client.auth.signOut({scope:'local'}).catch(()=>{});
  const current=await admin.auth.admin.getUserById(fixture.id);
  if(current.data.user?.user_metadata?.lending_auth_smoke===runId&&current.data.user.email===fixture.email) {
   const removed=await admin.auth.admin.deleteUser(fixture.id); if(!removed.error)cleaned++;
  }
 }
 const proof={supabaseRef:'mkmkkkdserlcaycknuxp',origin:target.origin,checks,syntheticUsersCreated:users.length,syntheticUsersRemoved:cleaned,passed:!process.exitCode&&cleaned===users.length};
 writeFileSync(`output/android/${withoutVercelCookie?'v171':'v170'}-auth-integration.json`,JSON.stringify(proof,null,2));
 console.log({syntheticUsersRemoved:cleaned,created:users.length});
 if(cleaned!==users.length)process.exitCode=1;
}
