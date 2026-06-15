@AGENTS.md

# TCG ROYAL - 郵送買取受付サービス

## 技術スタック
- Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Supabase（Auth・PostgreSQL・Storage）
- Resend（メール送信）
- Vercel（デプロイ）

## 環境構成
- ローカル：.env.local（テスト用Supabaseを参照）
- Preview（developブランチ）：Vercel環境変数→テスト用Supabase
- Production（mainブランチ）：Vercel環境変数→本番用Supabase

## Supabaseプロジェクト
- 本番：upmodzdzowehzfdquxir.supabase.co
- テスト：lpczpgrrgikcvkorbetl.supabase.co

## DBテーブル一覧
- profiles：ユーザー詳細情報（氏名・カナ・生年月日・性別・職業・住所・電話・本人確認・振込先）
- cards：カードマスタ（name・card_number・category・grade・buy_price・image_url）
- orders：買取申込（order_number・user_id・status・total_amount）
- order_items：注文明細（order_id・card_id・card_name・grade・quantity・unit_price）
- order_status_logs：ステータス変更履歴（order_id・old_status・new_status・changed_by）
- admin_users：管理者アカウント

## ステータス定義（order_status enum）
unhandled → accepted → waiting_arrival → inspecting → pending_approval → pending_transfer → completed
自動メール送信：accepted / waiting_arrival / completed の3つ

## order_number採番ルール
形式：YYYYMMDD-XX（例：20260504-01）
DBトリガーで自動採番（generate_order_number関数）

## ルーティング
### ユーザー側
- /：ホーム（カード一覧・ポケモン/ワンピースタブ）
- /cart：カート・申込フォーム（要認証）
- /cart/confirm：最終確認（要認証）
- /cart/complete：申込完了（要認証）
- /mypage：申込一覧（要認証）
- /mypage/orders/[id]：申込詳細（要認証）
- /mypage/profile：会員情報（要認証）
- /login：ログイン
- /register：新規登録
- /forgot-password：パスワードリセット

### 管理画面
- /admin：ダッシュボード（管理者のみ）
- /admin/orders：取引一覧（管理者のみ）
- /admin/orders/[id]：取引詳細・ステータス変更（管理者のみ）
- /admin/cards：カード管理（管理者のみ）
- /admin/cards/new：カード追加（管理者のみ）
- /admin/cards/[id]/edit：カード編集（管理者のみ）
- /admin/users：ユーザー一覧（管理者のみ）
- /admin/users/[id]：ユーザー詳細（管理者のみ）
- /admin/login：管理者ログイン

## APIエンドポイント
- POST /api/auth/register：ユーザー登録
- POST /api/upload/id-image：本人確認画像アップロード
- GET /api/cards：カード一覧
- POST /api/orders：買取申込作成
- GET /api/orders/[id]：申込詳細
- PATCH /api/admin/orders/[id]/status：ステータス更新＋メール送信
- GET /api/admin/orders：取引一覧
- GET/POST /api/admin/cards：カード管理
- PATCH/DELETE /api/admin/cards/[id]：カード編集・削除
- GET /api/admin/users：ユーザー一覧
- PATCH /api/admin/users/[id]/verify：本人確認ステータス更新
- GET /api/admin/users/export：古物台帳CSVエクスポート
- GET /api/admin/dashboard：KPI集計

## ファイル構成
- lib/supabase/client.ts：ブラウザ用Supabaseクライアント
- lib/supabase/server.ts：サーバー用Supabaseクライアント
- lib/supabase/admin.ts：管理者用Supabaseクライアント
- middleware.ts：認証チェック（/cart・/mypage→未認証は/loginへ、/admin→未認証は/admin/loginへ）
- supabase/migrations/001_init.sql：全テーブル定義・RLS・トリガー

## 命名規則
- コンポーネント：PascalCase
- 関数・変数：camelCase
- DBカラム：snake_case
- 環境変数：SCREAMING_SNAKE_CASE

## 実装済み
- Next.js 14プロジェクト初期化
- Supabase（本番・テスト）プロジェクト作成
- Vercel連携（main→本番、develop→テスト）
- lib/supabase/client.ts・server.ts・admin.ts
- middleware.ts（認証チェック）
- supabase/migrations/001_init.sql（全テーブル・RLS・トリガー）
- order_number自動採番トリガー（generate_order_number関数）
- Resendアカウント・APIキー取得済み

## 未実装（これから）
- Phase 2：ユーザー画面（登録・ログイン・カート・マイページ）
- Phase 3：管理画面
- Phase 4：メール・デプロイ・仕上げ