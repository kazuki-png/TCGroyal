// @vitest-environment node
import {expect,it} from 'vitest'
import {execFileSync} from 'node:child_process'
it('loads real Admin Auth with CommonJS/ESM interop disabled, rejecting malformed tokens without network',()=>{
 const source=`import {initializeApp,deleteApp} from 'firebase-admin/app';
 import {getAuth} from 'firebase-admin/auth';
 const app=initializeApp({projectId:'tcg-lending-preview'},'lending-sdk-smoke');
 try{await getAuth(app).verifyIdToken('not-a-jwt',true);throw Error('Malformed token accepted')}
 catch(error){if(error.code!=='auth/argument-error')throw error;process.stdout.write(error.code)}
 finally{await deleteApp(app)}`
 const result=execFileSync(process.execPath,['--no-experimental-require-module','--input-type=module','-e',source],{encoding:'utf8',windowsHide:true,timeout:10000})
 expect(result).toBe('auth/argument-error')
},15000)
