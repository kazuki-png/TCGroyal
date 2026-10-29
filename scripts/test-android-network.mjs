import {readdirSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const cache=join(process.env.USERPROFILE,'.gradle/caches/modules-2/files-2.1');
function jar(group,name,version){
 const root=join(cache,group,name,version);
 for(const hash of readdirSync(root))for(const file of readdirSync(join(root,hash)))if(file.endsWith('.jar'))return join(root,hash,file);
 throw Error('Missing local JVM dependency: '+name);
}
const classpath=[jar('com.squareup.okhttp3','okhttp','4.9.2'),jar('com.squareup.okio','okio-jvm','3.16.0'),jar('org.jetbrains.kotlin','kotlin-stdlib','2.3.0')].join(';');
const javaRoot=process.env.JAVA_HOME||'C:/Program Files/Android/Android Studio/jbr';
const output=resolve('output/android/network-jvm-test');mkdirSync(output,{recursive:true});
function run(name,args){const result=spawnSync(join(javaRoot,'bin',name+'.exe'),args,{encoding:'utf8',windowsHide:true,timeout:60000});if(result.status!==0)throw Error((result.stdout+result.stderr).slice(-5000));if(result.stdout)console.log(result.stdout.trim());}
run('javac',['-nowarn','-cp',classpath,'-d',output,'mobile/native-network/TcgHttpClients.java','__tests__/native/TcgHttpClientsTest.java']);
run('java',['-cp',output+';'+classpath,'TcgHttpClientsTest']);
