import {afterEach,expect,it,vi} from 'vitest';
import * as storage from '../../../mobile/src/secure-storage.web';
import {appendImageFile} from '../../../mobile/src/image-upload.web';
import {mobileFetch} from '../../../mobile/src/mobile-fetch.web';
import {Alert} from '../../../mobile/src/alert.web';
afterEach(()=>{sessionStorage.clear();vi.unstubAllGlobals();vi.restoreAllMocks()});
it('isolates auth and draft storage namespaces and clears only its own key',async()=>{
 await storage.setItemAsync('key','auth',{keychainService:'auth'});
 await storage.setItemAsync('key','draft',{keychainService:'draft'});
 await storage.deleteItemAsync('key',{keychainService:'draft'});
 expect(await storage.getItemAsync('key',{keychainService:'auth'})).toBe('auth');
 expect(await storage.getItemAsync('key',{keychainService:'draft'})).toBe(null);
});
it('uses an actual browser Blob and refuses remote URLs and oversized images',async()=>{
 const fetchMock=vi.fn().mockResolvedValue({blob:async()=>new Blob(['image'],{type:'image/png'})});vi.stubGlobal('fetch',fetchMock);
 const form=new FormData();await appendImageFile(form,'blob:https://example.com/card');
 expect(form.get('file')).toBeInstanceOf(Blob);
 await expect(appendImageFile(form,'https://example.com/card.png')).rejects.toThrow();
 fetchMock.mockResolvedValue({blob:async()=>new Blob([new Uint8Array(3*1024*1024+1)],{type:'image/png'})});
 await expect(appendImageFile(form,'blob:test')).rejects.toThrow('3MB');
});
it('leaves browser-controlled Origin untouched by removing native overrides',async()=>{
 const fetchMock=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetchMock);
 await mobileFetch('/api/lending/catalog',{headers:{Origin:'https://spoof.invalid','Accept-Encoding':'gzip',Authorization:'Bearer test'}});
 const headers=fetchMock.mock.calls[0][1].headers as Headers;
 expect(headers.has('Origin')).toBe(false);expect(headers.has('Accept-Encoding')).toBe(false);expect(headers.get('Authorization')).toBe('Bearer test');
});
it('never performs a destructive operation when confirmation is cancelled',()=>{
 const action=vi.fn();vi.spyOn(window,'confirm').mockReturnValue(false);
 Alert.alert('削除','確認',[{text:'戻る',style:'cancel'},{text:'削除',onPress:action}]);expect(action).not.toHaveBeenCalled();
});
