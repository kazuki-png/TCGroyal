import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
const name = `tcg-security-test-${process.pid}`;
const run = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
const sql = text => run(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-q'],text);
try {
 run(['run','--detach','--rm','--name',name,'-e','POSTGRES_PASSWORD=local-test-only','postgres:17-alpine']);
 let ready = false;
 for(let i=0;i<60;i++){
  try {
   if (!run(['logs',name]).includes('PostgreSQL init process complete')) throw new Error('initializing');
   sql('SELECT 1'); ready=true; break;
  } catch { await new Promise(r=>setTimeout(r,500)); }
 }
 if (!ready) throw new Error('PostgreSQL did not become ready');
 sql(readFileSync('__tests__/database/bootstrap.sql','utf8'));
 for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) { sql(readFileSync(`supabase/migrations/${f}`,'utf8')); }
 console.log(sql(readFileSync('__tests__/database/security.sql','utf8')));
 console.log('PostgreSQL security integration checks passed');
} catch(error) { console.error(error.stderr?.toString() || error.message); process.exitCode=1; }
finally { try{run(['stop',name]);}catch{} }
