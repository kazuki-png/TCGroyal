import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {startLocalDatabase} from './lending-local-runtime.mjs';
const tracked=execFileSync('git',['ls-files','supabase/migrations'],{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).map(file=>file.split('/').at(-1));
const migrationFiles=[...new Set([...tracked,'20261104095820_lending_bank_payments.sql'])];
let db;try{db=await startLocalDatabase({migrationFiles});console.log(db.sql(readFileSync('__tests__/database/lending-bank-payments.sql','utf8')));console.log('Bank payment SQL lifecycle passed; synthetic local data only.')}catch(e){console.error(e.stderr||e.message);process.exitCode=1}finally{db?.stop()}
