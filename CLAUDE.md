@AGENTS.md

# TCG Royal - 郵送買取受付サービス

## 技術スタック
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- Supabase（Auth・PostgreSQL・Storage）
- Resend（メール送信）

> **注意**: `middleware.ts` は Next.js 16 で非推奨。認証チェック用ファイルは `proxy.ts`（関数名も `proxy`）を使用すること。

## DB テーブル
- profiles（ユーザー詳細情報）
- cards（カードマスタ：pokemon/onepiece、グレードPSA10/9/8）
- orders（買取申込、ステータス管理）
- order_items（注文明細）
- order_status_logs（ステータス変更履歴）
- admin_users（管理者）

## ステータス定義
unhandled → accepted → waiting_arrival → inspecting → pending_approval → pending_transfer → completed
メール送信：accepted / waiting_arrival / completed の3つ

## ディレクトリ構成
- app/（ユーザー画面）
- app/admin/（管理画面）
- app/api/（Route Handlers）
- lib/supabase/（Supabaseクライアント）
- lib/email/（Resendメール送信）

## 命名規則
- コンポーネント：PascalCase
- 関数・変数：camelCase
- DBカラム：snake_case
- 環境変数：SCREAMING_SNAKE_CASE
