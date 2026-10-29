import {startLocalDatabase} from './lending-local-runtime.mjs';
import {readFileSync} from 'node:fs';
let db;try{db=await startLocalDatabase();console.log(db.sql(readFileSync('__tests__/database/lending-support-cases.sql','utf8')));console.log(db.sql(readFileSync('__tests__/database/lending-collateral-bundle.sql','utf8')));console.log('Single-card compatibility and bundled collateral lifecycle passed.');}catch(e){console.error(e.stderr||e.message);process.exitCode=1;}finally{db?.stop();}
