import {readFileSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createHmac} from 'node:crypto';import assert from 'node:assert/strict';
if(!process.argv.includes('--run-preview'))throw Error('Preview opt-in required');
const runtime=JSON.parse(readFileSync('.env.lending-preview-runtime.local','utf8'));assert.equal(runtime.LENDING_PREVIEW_DB_REF,'mkmkkkdserlcaycknuxp');assert.equal(runtime.LENDING_PREVIEW_SUPABASE_URL,'https://mkmkkkdserlcaycknuxp.supabase.co');
const token=createHmac('sha256',runtime.LENDING_PREVIEW_SESSION_SECRET).update('lending:due-reminders:v1').digest('hex');assert.match(token,/^[a-f0-9]{64}$/);
const sql=`BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $vault$ DECLARE secret_id uuid;BEGIN
 IF has_table_privilege('anon','vault.decrypted_secrets','SELECT') OR has_table_privilege('authenticated','vault.decrypted_secrets','SELECT') THEN RAISE EXCEPTION 'vault_access_not_private';END IF;
 SELECT id INTO secret_id FROM vault.secrets WHERE name='lending_preview_due_worker';
 IF secret_id IS NULL THEN PERFORM vault.create_secret('${token}','lending_preview_due_worker','Preview-only due reminder worker');
 ELSE PERFORM vault.update_secret(secret_id,'${token}','lending_preview_due_worker','Preview-only due reminder worker');END IF;
END $vault$;
SELECT cron.schedule('lending-preview-due-reminders','*/5 * * * *',$job$
 SELECT net.http_post(url:='https://tcg-royal-mobile-preview-collectorsrepublic.vercel.app/api/lending/reminders',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='lending_preview_due_worker')),body:='{}'::jsonb,timeout_milliseconds:=60000);
$job$);
COMMIT;`;
writeFileSync('tmp/.lending-reminder-scheduler.local.sql',sql);
const cli='C:/Users/ysk92/AppData/Local/npm-cache/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-windows-x64/bin/supabase.exe';
try{execFileSync(cli,['db','query','--linked','--project-ref','mkmkkkdserlcaycknuxp','--file','tmp/.lending-reminder-scheduler.local.sql'],{windowsHide:true,stdio:['ignore','pipe','pipe']});}catch(error){const safe=String(error.stderr??error.message).replaceAll(token,'[redacted]');writeFileSync('tmp/.lending-reminder-scheduler-error.local.txt',safe);throw Error('Preview scheduler configuration failed; private diagnostic saved.');}
console.log('Preview reminder scheduler configured every five minutes; worker credential stored in Vault.');
