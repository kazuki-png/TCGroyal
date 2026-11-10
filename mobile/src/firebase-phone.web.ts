export const firebaseProjectId:string|null=null;
const unavailable=()=>new Error('ブラウザ版ではメールアドレスでログインしてください。');
export async function firebaseIdToken():Promise<string>{throw unavailable()}
export async function firebaseAccountId():Promise<string>{throw unavailable()}
export async function signOutPhone(){}
export async function sendPhoneCode(_input:string):Promise<{confirm:(code:string)=>Promise<void>}>{throw unavailable()}
export async function watchPhoneSignIn(_callback:(phone:string,getToken:()=>Promise<string>)=>void){return ()=>{}}
export function phoneError(error:unknown){return error instanceof Error?error.message:unavailable().message}
