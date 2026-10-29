import {readFileSync} from 'node:fs';
import {startLocalDatabase} from './lending-local-runtime.mjs';
let db;
try{db=await startLocalDatabase();console.log(db.sql(readFileSync('__tests__/database/lending-status-push.sql','utf8')));console.log('Transactional status push queue verified with synthetic tokens; no Firebase calls made.');}
catch(e){console.error(e.stderr||e.message);process.exitCode=1;}finally{db?.stop();}
