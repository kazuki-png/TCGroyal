import {getTestApkDownload} from '@/lib/lending/test-distribution'
export const dynamic='force-dynamic';
export function GET(){
 if(process.env.VERCEL_ENV!=='preview')return new Response(null,{status:404});
 const download=getTestApkDownload();
 const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
 if(!download)return new Response('ダウンロードリンクの更新が必要です。担当者へご連絡ください。ブラウザ版は引き続きご利用いただけます。',{status:410,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
 return new Response(null,{status:302,headers:{...headers,Location:download.url}});
}
