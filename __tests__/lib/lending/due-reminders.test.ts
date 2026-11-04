// @vitest-environment node
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const m=vi.hoisted(()=>({client:vi.fn(),rpc:vi.fn(),single:vi.fn(),getUser:vi.fn(),push:vi.fn()}));
vi.mock('@/lib/lending/workflow-client',()=>({createWorkflowClient:m.client}));vi.mock('@/lib/lending/push',()=>({sendFcmMessage:m.push}));
import {dispatchDueReminders,reminderWorkerToken} from '@/lib/lending/due-reminders'
const job={id:'job',loan_id:'loan',user_id:'user',due_at:'2026-11-07T14:59:59Z',channel:'email',target_id:'user',lease_id:'lease'};
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('RESEND_API_KEY','fixture-key');vi.stubEnv('RESEND_FROM_EMAIL','TCG <test@example.com>');vi.stubEnv('LENDING_FCM_SERVICE_ACCOUNT_JSON','');const q={select:vi.fn(()=>q),eq:vi.fn(()=>q),maybeSingle:m.single};m.client.mockReturnValue({rpc:m.rpc,from:()=>q,auth:{admin:{getUserById:m.getUser}}});m.single.mockResolvedValue({data:{status:'active',due_at:job.due_at},error:null});m.rpc.mockImplementation(async(name)=>({data:name==='lending_claim_due_reminders'?[job]:null,error:null}));m.getUser.mockResolvedValue({data:{user:{email:'user@example.com',email_confirmed_at:'2026-01-01'}},error:null})});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});
describe('due reminders',()=>{
 it('does not send a reminder for an extended or closed contract',async()=>{m.single.mockResolvedValue({data:{status:'returned',due_at:job.due_at},error:null});const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await dispatchDueReminders();expect(fetch).not.toHaveBeenCalled();expect(m.rpc).toHaveBeenCalledWith('lending_finish_due_reminder',expect.objectContaining({p_error:'recipient_unavailable'}))});
 it('sends a minimal email with an idempotency key and records acceptance',async()=>{const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'provider-id'})});vi.stubGlobal('fetch',fetch);await dispatchDueReminders();expect(fetch.mock.calls[0][1].headers['Idempotency-Key']).toBe('lending-due-job');const payload=JSON.parse(fetch.mock.calls[0][1].body);expect(payload.text).not.toContain('¥');expect(payload.to).toEqual(['user@example.com']);expect(m.rpc).toHaveBeenCalledWith('lending_finish_due_reminder',expect.objectContaining({p_provider:'provider-id',p_error:null}))});
 it('never sends to unconfirmed addresses or synthetic invalid addresses',async()=>{m.getUser.mockResolvedValue({data:{user:{email:'fixture@example.invalid',email_confirmed_at:'2026-01-01'}},error:null});const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await dispatchDueReminders();expect(fetch).not.toHaveBeenCalled();expect(reminderWorkerToken('fixture')).not.toBe(reminderWorkerToken('different'))});
})
