export const TEST_APK = {
  version: '1.31.0',
  sizeBytes: 32822633,
  sha256: 'eea701d8790344e22329bc35390f1ec93bcae37d5febf68decf8ed1835984445',
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
