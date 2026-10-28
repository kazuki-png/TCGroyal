import { startLocalApp } from './lending-local-runtime.mjs';
const runtime=await startLocalApp();
console.log(`Local lending demo: ${runtime.origin}/lending`);
console.log(`Mobile API origin: ${runtime.origin} (EXPO_PUBLIC_LENDING_API_URL)`);
console.log('Synthetic users, local database and fixture prices only. Ctrl+C stops and removes this session.');
let stopping=false;
const stop=async()=>{if(stopping)return;stopping=true;await runtime.stop();process.exit(0);};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
