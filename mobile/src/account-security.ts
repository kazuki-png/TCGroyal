import {confirmedSupabaseUser,supabaseAuth,supabaseBearer} from './supabase-auth';
import {AUTH_REDIRECT_URL} from './supabase-config';
async function verifyAccount(){
 const user=await confirmedSupabaseUser();
 const assurance=await supabaseAuth.auth.mfa.getAuthenticatorAssuranceLevel(await supabaseBearer());
 if(assurance.error)throw assurance.error;
 if(assurance.data?.nextLevel==='aal2'&&assurance.data.currentLevel!=='aal2')throw Error('認証アプリでの確認が必要です。多要素認証を完了して再度ログインしてください。');
 return user;
}
export async function changeAccountEmail(email:string){
 const address=email.trim();if(address.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))throw Error('新しいメールアドレスを確認してください。');
 const user=await verifyAccount();if(address.toLowerCase()===user.email?.toLowerCase())throw Error('現在とは異なるメールアドレスを入力してください。');
 const result=await supabaseAuth.auth.updateUser({email:address},{emailRedirectTo:AUTH_REDIRECT_URL});if(result.error)throw result.error;
 return result.data.user?.email?.toLowerCase()===address.toLowerCase();
}
export async function changeAccountPassword(current:string,password:string,confirm:string,nonce=''){
 if(!current||current.length>128)throw Error('現在のパスワードを入力してください。');
 if(password.length<12||password.length>128||password!==confirm)throw Error('12文字以上の新しいパスワードと確認欄を一致させてください。');
 if(password===current)throw Error('現在とは異なるパスワードを設定してください。');
 if(nonce&&!/^\d{6}$/.test(nonce))throw Error('確認コードを6桁で入力してください。');
 await verifyAccount();const result=await supabaseAuth.auth.updateUser({password,current_password:current,...(nonce?{nonce}:{})});if(result.error)throw result.error;
}
export async function sendAccountConfirmation(){await verifyAccount();const result=await supabaseAuth.auth.reauthenticate();if(result.error)throw result.error;}
