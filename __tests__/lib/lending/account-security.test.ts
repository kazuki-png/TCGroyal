// @vitest-environment node
import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn(),bearer:vi.fn(),assurance:vi.fn(),update:vi.fn(),reauthenticate:vi.fn()}));
vi.mock('@/mobile/src/supabase-auth',()=>({confirmedSupabaseUser:mocks.user,supabaseBearer:mocks.bearer,supabaseAuth:{auth:{mfa:{getAuthenticatorAssuranceLevel:mocks.assurance},updateUser:mocks.update,reauthenticate:mocks.reauthenticate}}}));
vi.mock('@/mobile/src/supabase-config',()=>({AUTH_REDIRECT_URL:'tcgroyal-preview://auth/callback'}));
import {changeAccountEmail,changeAccountPassword,sendAccountConfirmation} from '@/mobile/src/account-security';
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({email:'fixture@example.invalid'});mocks.bearer.mockResolvedValue('fixture');mocks.assurance.mockResolvedValue({data:{currentLevel:'aal1',nextLevel:'aal1'},error:null});mocks.update.mockResolvedValue({data:{user:{email:'fixture@example.invalid'}},error:null});mocks.reauthenticate.mockResolvedValue({error:null})});
describe('account settings updates',()=>{
 it('uses the current authenticated account and preserves confirmation redirects',async()=>{
  expect(await changeAccountEmail(' changed@example.invalid ')).toBe(false);
  expect(mocks.update).toHaveBeenCalledWith({email:'changed@example.invalid'},{emailRedirectTo:'tcgroyal-preview://auth/callback'});
  mocks.update.mockResolvedValue({data:{user:{email:'changed@example.invalid'}},error:null});expect(await changeAccountEmail('changed@example.invalid')).toBe(true);
 });
 it.each(['invalid','a@b@example.invalid','fixture@example.invalid'])('rejects an invalid or unchanged email %s',async address=>{await expect(changeAccountEmail(address)).rejects.toThrow();expect(mocks.update).not.toHaveBeenCalled()});
 it('does not bypass required MFA for email, password or confirmation emails',async()=>{
  mocks.assurance.mockResolvedValue({data:{currentLevel:'aal1',nextLevel:'aal2'},error:null});
  await expect(changeAccountEmail('changed@example.invalid')).rejects.toThrow('多要素');await expect(changeAccountPassword('current-fixture','changed-fixture','changed-fixture')).rejects.toThrow('多要素');await expect(sendAccountConfirmation()).rejects.toThrow();expect(mocks.update).not.toHaveBeenCalled();expect(mocks.reauthenticate).not.toHaveBeenCalled();
 });
 it('validates password confirmation and does not call the provider on malformed input',async()=>{
  await expect(changeAccountPassword('old','short','short')).rejects.toThrow();await expect(changeAccountPassword('old','changed-fixture','different-fixture')).rejects.toThrow();await expect(changeAccountPassword('current-fixture','current-fixture','current-fixture')).rejects.toThrow();await expect(changeAccountPassword('old','changed-fixture','changed-fixture','bad')).rejects.toThrow();expect(mocks.update).not.toHaveBeenCalled();
 });
 it('passes current password and optional nonce to Supabase and propagates provider errors',async()=>{
  await changeAccountPassword('current-fixture','changed-fixture','changed-fixture','123456');expect(mocks.update).toHaveBeenCalledWith({current_password:'current-fixture',password:'changed-fixture',nonce:'123456'});
  const failure={code:'reauthentication_needed'};mocks.update.mockResolvedValue({error:failure});await expect(changeAccountPassword('old','changed-fixture','changed-fixture')).rejects.toEqual(failure);
 });
 it('requests a confirmation code only when explicitly invoked',async()=>{expect(mocks.reauthenticate).not.toHaveBeenCalled();await sendAccountConfirmation();expect(mocks.reauthenticate).toHaveBeenCalledOnce()});
});
