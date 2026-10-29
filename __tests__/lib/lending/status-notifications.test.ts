// @vitest-environment node
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const m=vi.hoisted(()=>({rpc:vi.fn(),send:vi.fn(),after:vi.fn()}))
vi.mock('next/server',()=>({after:m.after}))
vi.mock('@/lib/lending/workflow-client',()=>({createWorkflowClient:()=>({rpc:m.rpc})}))
vi.mock('@/lib/lending/push',()=>({sendFcmStatus:m.send}))
import {dispatchStatusNotifications,scheduleStatusNotifications} from '@/lib/lending/status-notifications'
const job={id:'job',notificationId:'event',leaseId:'lease',token:'fixture-device-token',kind:'case',entityId:'case'}
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('LENDING_FCM_SERVICE_ACCOUNT_JSON','fixture-not-real');m.rpc.mockImplementation(async(name:string)=>({data:name==='lending_claim_status_push'?[job]:null,error:null}));m.send.mockResolvedValue('provider-message')})
afterEach(()=>vi.unstubAllEnvs())
describe('status notification dispatcher',()=>{
 it('claims work and records provider acceptance with the matching lease',async()=>{
  expect(await dispatchStatusNotifications('case','case')).toEqual({configured:true,processed:1});expect(m.send).toHaveBeenCalledWith(job.token,{id:'event',kind:'case',entityId:'case'});
  expect(m.rpc).toHaveBeenCalledWith('lending_finish_status_push',{p_job:'job',p_lease:'lease',p_message:'provider-message',p_error:null});
 })
 it('preserves pending jobs when configuration is absent',async()=>{vi.stubEnv('LENDING_FCM_SERVICE_ACCOUNT_JSON','');expect(await dispatchStatusNotifications()).toEqual({configured:false,processed:0});scheduleStatusNotifications();expect(m.rpc).not.toHaveBeenCalled();expect(m.after).not.toHaveBeenCalled()})
 it('records bounded errors without exposing provider payloads or cancelling another send',async()=>{
  m.rpc.mockImplementation(async(name:string)=>({data:name==='lending_claim_status_push'?[job,{...job,id:'second'}]:null,error:null}));m.send.mockRejectedValueOnce(Error('private-provider-payload')).mockResolvedValueOnce('second-ok');
  await dispatchStatusNotifications();expect(m.rpc).toHaveBeenCalledWith('lending_finish_status_push',expect.objectContaining({p_job:'job',p_error:'push_send_failed'}));expect(m.rpc).toHaveBeenCalledWith('lending_finish_status_push',expect.objectContaining({p_job:'second',p_message:'second-ok'}));
 })
 it('schedules work after the response and handles durable queue errors',async()=>{scheduleStatusNotifications('loan','id');expect(m.after).toHaveBeenCalledOnce();m.rpc.mockRejectedValue(Error('db error'));await expect(m.after.mock.calls[0][0]()).resolves.toBeUndefined()})
})
