// @vitest-environment node
import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
 key:'fixture-account',disabled:false,listener:null as null|((token:{type:'android';data:string})=>void),
 api:vi.fn(),read:vi.fn(),permission:vi.fn(),write:vi.fn(),
}));
vi.mock('../../../mobile/node_modules/react-native/index.js',()=>({Platform:{OS:'android'}}));
vi.mock('../../../mobile/node_modules/expo-notifications',()=>({
 setNotificationChannelAsync:vi.fn(),getPermissionsAsync:mocks.permission,
 requestPermissionsAsync:mocks.permission,getDevicePushTokenAsync:mocks.read,
 unregisterForNotificationsAsync:vi.fn(),
 addPushTokenListener:(callback:typeof mocks.listener)=>{mocks.listener=callback;return{remove:()=>{mocks.listener=null}}},
 AndroidImportance:{HIGH:4},
}));
vi.mock('../../../mobile/node_modules/@react-native-async-storage/async-storage',()=>({default:{
 getItem:async()=>mocks.disabled?'disabled':null,setItem:mocks.write,
}}));
vi.mock('../../../mobile/src/api',()=>({lendingApi:mocks.api,getInboxStorageKey:()=>mocks.key}));

const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
beforeEach(()=>{
 vi.resetModules();vi.clearAllMocks();mocks.key='fixture-account';mocks.disabled=false;mocks.listener=null;
 mocks.permission.mockResolvedValue({granted:true});mocks.api.mockResolvedValue({deviceId:'fixture-device'});
 mocks.read.mockImplementation(async()=>{
  // Actual Expo Android behavior: every explicit read also emits onDevicePushToken.
  mocks.listener?.({type:'android',data:'fixture-token'});
  return {type:'android',data:'fixture-token'};
 });
});
describe('status push token events',()=>{
 it('does not re-read the token when Android emits it, and coalesces startup registration',async()=>{
  const push=await import('../../../mobile/src/status-push');const subscription=push.watchStatusPushToken();
  await push.registerStatusPush();await flush();
  expect(mocks.read).toHaveBeenCalledOnce();expect(mocks.api).toHaveBeenCalledOnce();
  for(let i=0;i<100;i++)mocks.listener?.({type:'android',data:'fixture-token'});
  await flush();expect(mocks.read).toHaveBeenCalledOnce();expect(mocks.api).toHaveBeenCalledOnce();
  mocks.listener?.({type:'android',data:'rotated-token'});await flush();
  expect(mocks.api).toHaveBeenCalledTimes(2);
  expect(mocks.api.mock.calls[1][1].body.token).toBe('rotated-token');subscription.remove();
 });
 it('respects opt-out for token change events without reading or uploading a token',async()=>{
  mocks.disabled=true;const push=await import('../../../mobile/src/status-push');push.watchStatusPushToken();
  mocks.listener?.({type:'android',data:'fixture-token'});await flush();
  expect(mocks.read).not.toHaveBeenCalled();expect(mocks.api).not.toHaveBeenCalled();
 });
 it('permits a later attempt after a failed registration without automatic retry',async()=>{
  mocks.api.mockRejectedValueOnce(Error('429'));
  const push=await import('../../../mobile/src/status-push');
  await expect(push.registerStatusPush(false,{type:'android',data:'fixture-token'})).rejects.toThrow('429');
  await flush();expect(mocks.api).toHaveBeenCalledOnce();
  await push.registerStatusPush(false,{type:'android',data:'fixture-token'});expect(mocks.api).toHaveBeenCalledTimes(2);
 });
 it('does not restore local registration when a request finishes after unregistering',async()=>{
  let finish!:(value:{deviceId:string})=>void;
  mocks.api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
  const push=await import('../../../mobile/src/status-push');
  const registration=push.registerStatusPush(false,{type:'android',data:'fixture-token'});await flush();
  await push.unregisterStatusPush();finish({deviceId:'fixture-device'});
  expect(await registration).toBeNull();expect(push.currentStatusPushDevice()).toBeNull();expect(mocks.write).toHaveBeenCalledOnce();
 });
});
