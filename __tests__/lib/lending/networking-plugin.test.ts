import {createRequire} from 'node:module';
import {describe,it,expect} from 'vitest';
const load=createRequire(import.meta.url);
const {applyNetworking}=load('../../../mobile/networking-plugin.cjs') as {applyNetworking:(value:string)=>string};
const source=`class MainApplication {
 val packages = PackageList(this).packages.apply { }
 override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
 }
}`;
describe('Android transport initialization',()=>{
 it('installs the supported factory before React/Expo creates its clients and registers the read-only diagnostic module',()=>{
  const patched=applyNetworking(source);
  expect(patched.indexOf('setOkHttpClientFactory')).toBeLessThan(patched.indexOf('loadReactNative(this)'));
  expect(patched).toContain('createClientBuilder(applicationContext)');expect(patched).toContain('TcgNetworkPackage()');expect(applyNetworking(patched)).toBe(patched);
 })
 it('fails rather than silently omitting configuration on an unsupported generated template',()=>{expect(()=>applyNetworking('unknown template')).toThrow('Unrecognized')})
})
