// @vitest-environment node
import {afterEach,describe,it,expect,vi} from 'vitest'
import {generateKeyPairSync} from 'node:crypto'
vi.mock('server-only',()=>({}))
import {sendFcmStatus} from '@/lib/lending/push'
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
describe('status push privacy and invalid tokens',()=>{
 it('sends only generic text and opaque routing IDs, and does not disable devices on a generic 404',async()=>{
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});vi.stubEnv('LENDING_FCM_SERVICE_ACCOUNT_JSON',JSON.stringify({project_id:'fixture-project',client_email:'fixture@example.invalid',private_key:privateKey.export({format:'pem',type:'pkcs8'})}));
  const network=vi.fn().mockResolvedValueOnce(Response.json({access_token:'fixture-oauth-token'})).mockResolvedValueOnce(Response.json({name:'projects/fixture/messages/1'}));vi.stubGlobal('fetch',network);
  await sendFcmStatus('fixture-device',{id:'event',kind:'loan',entityId:'loan'});const body=JSON.parse(network.mock.calls[1][1].body);expect(body.message.notification.body).toBe('お手続きの状況が更新されました。アプリでご確認ください。');expect(body.message.data).toEqual({screen:'loans',notificationId:'event',entityKind:'loan',entityId:'loan'});expect(body.message.android.notification.tag).toBe('event');
  network.mockResolvedValueOnce(Response.json({access_token:'fixture-oauth-token'})).mockResolvedValueOnce(Response.json({error:{status:'NOT_FOUND'}},{status:404}));await expect(sendFcmStatus('fixture-device',{id:'e',kind:'case',entityId:'c'})).rejects.toThrow('fcm_send_failed');
  network.mockResolvedValueOnce(Response.json({access_token:'fixture-oauth-token'})).mockResolvedValueOnce(Response.json({error:{details:[{errorCode:'UNREGISTERED'}]}},{status:404}));await expect(sendFcmStatus('fixture-device',{id:'e',kind:'case',entityId:'c'})).rejects.toThrow('device_not_registered');
 })
})
