import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
// Generated assets are Preview-only; never include native credentials or source maps.
if(process.env.VERCEL_ENV!=='preview'&&process.env.LENDING_WEB_EXPORT!=='1')process.exit(0);
const root=fileURLToPath(new URL('../',import.meta.url));
const mobile=join(root,'mobile');
if(!JSON.parse(readFileSync(join(mobile,'package.json'),'utf8')).dependencies?.expo)throw Error('Mobile Web sources missing from deployment');
const env={...process.env,EXPO_NO_DOTENV:'1',EXPO_PUBLIC_LENDING_CHANNEL:'preview',LENDING_WEB_EXPORT:'1',CI:'1'};
function run(args,cwd){const result=spawnSync(process.execPath,args,{cwd,env,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
if(process.env.VERCEL==='1')run([process.env.npm_execpath,'ci','--prefix',mobile,'--include=dev','--no-audit','--no-fund'],mobile);
run(['node_modules/expo/bin/cli','export','--platform','web','--output-dir',join(root,'public/lending-web')],mobile);
const html=join(root,'public/lending-web/index.html');
writeFileSync(html,readFileSync(html,'utf8').replace('<html lang="en">','<html lang="ja">').replace('</head>','<meta name="robots" content="noindex,nofollow"><style>body{background:#080808}#root{max-width:720px;margin:auto;height:100dvh}</style></head>'));
