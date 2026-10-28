import { lendingAccess,lendingJson } from '@/lib/lending/api-guard'
// Fail closed until the chosen JPKI provider's SDK/callback verification is
// integrated and sandbox credentials are supplied. Never accept a client-side
// "verified" flag, NFC read result or a document upload as JPKI verification.
export async function POST(request:Request){
 const actor=await lendingAccess(request,'lending:jpki-start',6);if(actor instanceof Response)return actor
 return lendingJson({error:'JPKIのテスト接続は準備中です。接続事業者の登録・テスト用認証情報の設定後に、画像提出なしで本人確認を開始できます。',code:'jpki_not_configured'},503)
}
