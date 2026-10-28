import {startLocalDatabase} from './lending-local-runtime.mjs';
import {readFileSync} from 'node:fs';
let db;try{db=await startLocalDatabase();console.log(db.sql(readFileSync('__tests__/database/lending-support-cases.sql','utf8')));console.log('Support cases and manual loan lifecycle verified on local PostgreSQL.');}catch(e){console.error(e.stderr||e.message);process.exitCode=1;}finally{db?.stop();}
