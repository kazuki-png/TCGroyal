// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {proxy} from '@/proxy';
import {GET as download} from '@/app/lending/download/route';
import {GET as landing} from '@/app/lending/test/route';
import {getTestApkDownload} from '@/lib/lending/test-distribution';
import {MOBILE_PREVIEW_ORIGIN,isMobilePreviewPath} from '@/lib/lending/mobile-preview-host';
afterEach(()=>vi.unstubAllEnvs());
it('serves the browser camera only in Preview and keeps admin unavailable',async()=>{
 vi.stubEnv('VERCEL_ENV','preview');
 const response=await proxy(new NextRequest(MOBILE_PREVIEW_ORIGIN+'/lending-web/index.html'));
 expect(response.headers.get('Permissions-Policy')).toContain('camera=(self)');
 expect((await proxy(new NextRequest(MOBILE_PREVIEW_ORIGIN+'/admin'))).status).toBe(404);
 expect(isMobilePreviewPath('/lending-web/_expo/static/js/web/index-ab.js')).toBe(true);
 expect(isMobilePreviewPath('/lending-web/_expo/index.js.map')).toBe(false);
 expect(isMobilePreviewPath('/lending-web/assets/../../secret')).toBe(false);
 vi.stubEnv('VERCEL_ENV','production');
 expect((await proxy(new NextRequest(MOBILE_PREVIEW_ORIGIN+'/lending-web/index.html'))).status).toBe(404);
 expect(landing().status).toBe(404);expect(download().status).toBe(404);
});
it('does not redirect to expired or unrelated signed objects',()=>{
 vi.stubEnv('VERCEL_ENV','preview');
 const valid={url:'https://mkmkkkdserlcaycknuxp.supabase.co/storage/v1/object/sign/lending-test-apk-private/test.apk?token=test',expiresAt:Date.now()+60000};
 vi.stubEnv('LENDING_TEST_APK_DOWNLOAD_JSON',JSON.stringify(valid));expect(download().status).toBe(302);
 expect(download().headers.get('Cache-Control')).toContain('no-store');
 expect(getTestApkDownload(valid.expiresAt)).toBe(null);
 vi.stubEnv('LENDING_TEST_APK_DOWNLOAD_JSON',JSON.stringify({...valid,url:'https://example.com/test.apk?token=test'}));
 expect(download().status).toBe(410);
 vi.stubEnv('LENDING_TEST_APK_DOWNLOAD_JSON','broken');expect(download().status).toBe(410);
});
it('offers mobile and PC access without publishing account credentials',async()=>{
 vi.stubEnv('VERCEL_ENV','preview');const text=await landing().text();
 expect(text).toContain(MOBILE_PREVIEW_ORIGIN+'/lending-web/index.html');
 expect(text).toContain(MOBILE_PREVIEW_ORIGIN+'/lending/download');
 expect(text).toContain('ログイン情報は担当者から別途');
});
