import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createServer as httpServer, request as httpRequest } from 'node:http';
import { createServer as netServer } from 'node:net';
import { createHmac } from 'node:crypto';

const run = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', windowsHide: true, stdio: ['pipe','pipe','pipe'] });
const jwtSecret = 'tcg-royal-local-fixture-only-not-for-production-2026';
const token = role => {
 const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
 const data = `${encode({ alg:'HS256',typ:'JWT' })}.${encode({ role,exp:Math.floor(Date.now()/1000)+86400 })}`;
 return `${data}.${createHmac('sha256',jwtSecret).update(data).digest('base64url')}`;
};
export const fixtureIds = {
 customer:'10000000-0000-4000-8000-000000000001', admin:'10000000-0000-4000-8000-000000000002',
 other:'10000000-0000-4000-8000-000000000003', card:'20000000-0000-4000-8000-000000000001',
};
export async function startLocalDatabase() {
 const name = `tcg-lending-local-${process.pid}`;
 const sql = text => run(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-qAt'],text);
 const stop = () => { try { run(['stop',name]); } catch {} };
 try {
  run(['run','--detach','--rm','--name',name,'-e','POSTGRES_PASSWORD=local-test-only','postgres:17-alpine']);
  let ready=false;
  for(let i=0;i<60;i++) {
   try { if (!run(['logs',name]).includes('PostgreSQL init process complete')) throw Error('initializing'); sql('select 1');ready=true;break; }
   catch { await new Promise(resolve=>setTimeout(resolve,500)); }
  }
  if(!ready) throw Error('Local PostgreSQL did not become ready');
  sql(readFileSync('__tests__/database/bootstrap.sql','utf8'));
  for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) sql(readFileSync(`supabase/migrations/${file}`,'utf8'));
  sql(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
   ('${fixtureIds.customer}','customer@example.invalid',now()),('${fixtureIds.admin}','admin@example.invalid',now()),('${fixtureIds.other}','other@example.invalid',now());
   UPDATE public.profiles SET birthday='1990-01-01';
   INSERT INTO public.admin_users(id,role) VALUES('${fixtureIds.admin}','admin');
   INSERT INTO public.cards(public_uid,name,category,grade,buy_price,buy_price_updated_at,card_number)
   VALUES('${fixtureIds.card}','ローカル検証カード','pokemon','PSA10',1000000,now(),'TEST-001');
   SET ROLE service_role;
   SELECT public.lending_verify_mapping('${fixtureIds.admin}','${fixtureIds.card}','408333');
   INSERT INTO public.lending_identity_checks(user_id,method,verified_at,expires_at,evidence_reference,verified_by)
   VALUES('${fixtureIds.customer}','test_fixture',now(),now()+interval '1 day','LOCAL-SYNTHETIC-IDENTITY','${fixtureIds.admin}'); RESET ROLE;`);
  return { name,sql,stop };
 } catch(error) { stop(); throw error; }
}

const freePort = () => new Promise((resolve,reject)=>{
 const server=netServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});
});
export async function startLocalApp() {
 const db=await startLocalDatabase();
 const apiName=`${db.name}-rest`;
 let bridge, child;
 const stop=async()=>{
  if(child && !child.killed) {
   if(process.platform==='win32') { try { execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true}); } catch {} }
   else child.kill('SIGTERM');
  }
  if(bridge) await new Promise(resolve=>bridge.close(resolve));
  try { run(['stop',apiName]); } catch {}
  db.stop();
 };
 try {
  const dbIp=run(['inspect','--format','{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',db.name]).trim();
  run(['run','--detach','--rm','--name',apiName,'-p','127.0.0.1::3000',
   '-e',`PGRST_DB_URI=postgres://postgres:local-test-only@${dbIp}:5432/postgres`,
   '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${jwtSecret}`,
   'postgrest/postgrest:v12.2.12']);
  const apiPort=JSON.parse(run(['inspect','--format','{{json .NetworkSettings.Ports}}',apiName]))['3000/tcp'][0].HostPort;
  // Local PostgREST bridge reproduces Supabase's /rest/v1 path without any remote service.
  bridge=httpServer((request,response)=>{
   if(!request.url?.startsWith('/rest/v1/')) { response.writeHead(404).end();return; }
   const upstream=httpRequest({hostname:'127.0.0.1',port:apiPort,path:request.url.slice('/rest/v1'.length),method:request.method,headers:request.headers},result=>{
    response.writeHead(result.statusCode??502,result.headers);result.pipe(response);
   });
   upstream.on('error',()=>response.writeHead(502).end());request.pipe(upstream);
  });
  await new Promise(resolve=>bridge.listen(0,'127.0.0.1',resolve));
  const dbUrl=`http://127.0.0.1:${bridge.address().port}`;
  for(let i=0;i<40;i++) {
   try { const result=await fetch(`${dbUrl}/rest/v1/`,{headers:{Authorization:`Bearer ${token('service_role')}`}});if(result.ok)break; }
   catch {}
   if(i===39)throw Error('Local REST API did not become ready');
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  const appPort=await freePort();const origin=`http://127.0.0.1:${appPort}`;
  child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(appPort)],{
   windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,
    NODE_ENV:'development',VERCEL:'',LENDING_WORKFLOW_ENABLED:'true',LENDING_LOCAL_DEMO:'true',LENDING_MARKET_FIXTURE:'true',
    NEXT_PUBLIC_SUPABASE_URL:dbUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:token('anon'),SUPABASE_SERVICE_ROLE_KEY:token('service_role'),
    NEXT_PUBLIC_SITE_URL:origin,ADMIN_ALLOWED_HOSTS:`127.0.0.1:${appPort}`,RESEND_API_KEY:'',CRON_SECRET:'',REFERENCE_PRICES_CRON_SECRET:'',
    PSA_API_ACCESS_TOKEN:'',OPENAI_API_KEY:'',LENDING_FCM_SERVICE_ACCOUNT_JSON:'',
   },
  });
  let output='';child.stdout.on('data',data=>{output=(output+data.toString()).slice(-12000);});child.stderr.on('data',data=>{output=(output+data.toString()).slice(-12000);});
  for(let i=0;i<90;i++) {
   if(child.exitCode!==null)throw Error(`Local Next.js exited: ${output}`);
   try { const response=await fetch(`${origin}/api/lending/workflow`);if(response.ok)return { ...db,origin,dbUrl,stop,logs:()=>output }; }
   catch {}
   if(i===89)throw Error(`Local Next.js startup failed: ${output}`);
   await new Promise(resolve=>setTimeout(resolve,500));
  }
 } catch(error) { await stop(); throw error; }
}
