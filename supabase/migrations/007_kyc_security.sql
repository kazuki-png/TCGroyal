-- =============================================
-- KYC本人確認書類のセキュリティ強化
-- =============================================

-- admin_users に role カラムを追加
-- 'admin'        : 通常管理者（本人確認書類の閲覧不可）
-- 'kyc_reviewer' : 本人確認書類の審査権限あり
alter table public.admin_users
  add column if not exists role text not null default 'admin'
  check (role in ('admin', 'kyc_reviewer'));

-- =============================================
-- 本人確認書類メタデータテーブル
-- =============================================
create table if not exists public.identity_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  storage_path  text not null,
  document_type text,
  status        text not null default 'pending'
                check (status in ('pending', 'verified', 'rejected')),
  uploaded_at   timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users(id) on delete set null,
  deleted_at    timestamptz
);

alter table public.identity_documents enable row level security;

-- ユーザーは自分のメタデータのみ参照可（書類ファイル自体は取得不可）
create policy "ユーザーは自分の書類メタデータを参照できる"
  on public.identity_documents for select
  using (auth.uid() = user_id);

-- INSERT / UPDATE は service_role のみ（サーバー側）
-- SELECT 以外のポリシーは意図的に設定しない

-- =============================================
-- 閲覧ログテーブル
-- =============================================
create table if not exists public.identity_document_access_logs (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.identity_documents(id) on delete cascade,
  accessed_by uuid not null references auth.users(id) on delete cascade,
  accessed_at timestamptz not null default now(),
  action      text not null check (action in ('view', 'delete', 'verify', 'reject')),
  reason      text
);

alter table public.identity_document_access_logs enable row level security;
-- 閲覧ログはユーザー側からアクセス不可（service_role のみ読み書きする）

-- =============================================
-- identity-images バケットのストレージ RLS
-- =============================================
-- サーバー側の service_role によるアップロードが主経路だが、
-- ブラウザ直接アップロードが発生した場合でも自分のフォルダ以外に書き込めないよう明示的に設定する
create policy "identity-images: ユーザーは自分のフォルダにのみアップロード可"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'identity-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT / UPDATE / DELETE ポリシーは意図的に設定しない
-- ファイルへのアクセスは service_role を使うサーバー側 API のみが signed URL を発行する
