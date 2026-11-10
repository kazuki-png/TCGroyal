export const TEST_APK = {
  version: '1.30.0',
  sizeBytes: 33220489,
  sha256: 'e65cff920dbeb1d397d2cfe984d95349f091cef4184d5b607f6f475c435d5ed9',
} as const;

// A finite, private-object link. Never mint an anonymous permanent download capability.
export function getTestApkDownload(now=Date.now()):{url:string;expiresAt:number}|null {
 try {
  const value=JSON.parse(process.env.LENDING_TEST_APK_DOWNLOAD_JSON??'null');
  if(!value||typeof value.url!=='string'||!Number.isFinite(value.expiresAt)||value.expiresAt<=now)return null;
  const url=new URL(value.url);
  if(url.origin!=='https://mkmkkkdserlcaycknuxp.supabase.co'||url.username||url.password||
   !url.pathname.startsWith('/storage/v1/object/sign/lending-test-apk-private/')||!url.pathname.endsWith('.apk')||!url.searchParams.get('token'))return null;
  return {url:url.toString(),expiresAt:value.expiresAt};
 }catch{return null;}
}
