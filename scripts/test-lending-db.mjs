import { startLocalDatabase } from './lending-local-runtime.mjs';
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile);
let db;
try {
 db=await startLocalDatabase();
 console.log(db.sql(readFileSync('__tests__/database/lending.sql','utf8')));
 // Two independent DB connections race to fund the same accepted contract.
 const id=db.sql("select id from lending_loans where cert_number='99990002'").trim();
 const command=ref=>`SET ROLE service_role; SELECT lending_command('10000000-0000-4000-8000-000000000002','${id}','fund','{"amountJpy":300000,"reference":"${ref}"}',gen_random_uuid(),4);`;
 const results=await Promise.allSettled(['race-fund-1','race-fund-2'].map(ref=>exec('docker',['exec','-i',db.name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-qAt','-c',command(ref)],{windowsHide:true})));
 if(results.filter(r=>r.status==='fulfilled').length!==1)throw Error('Concurrent funding must have exactly one winner');
 if(db.sql(`SELECT count(*) FROM lending_ledger WHERE loan_id='${id}' AND kind='disbursement'`).trim()!=='1')throw Error('Duplicate funding ledger');
 console.log(db.sql(readFileSync('__tests__/database/lending-mobile.sql','utf8')));
 console.log('Local PostgreSQL lending workflow, privileges, immutable evidence and concurrent funding checks passed');
} catch(error) {console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
finally {db?.stop();}
