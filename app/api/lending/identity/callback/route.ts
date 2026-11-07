import {sandboxDocument} from '@/lib/lending/sandbox-document'
export const dynamic = 'force-dynamic'

// Registration endpoint only. No issued client ID / authorization transaction exists yet.
// Never echo, log, exchange or persist an unsolicited code/state or mark an actor verified.
export function GET(request: Request) {
  const hasAuthorizationResponse = new URL(request.url).search.length > 0
  return sandboxDocument('本人確認のテスト接続', [
    ['接続準備中','デジタル認証サービスのテスト環境への接続登録を進めています。このページは本人確認結果の受信先です。'],
    ['アプリに戻ってください','現在は本人確認を開始・完了できません。接続準備が整いましたら、アプリからあらためて操作してください。'],
  ], hasAuthorizationResponse ? 400 : 200)
}
