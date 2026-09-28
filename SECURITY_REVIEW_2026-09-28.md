# セキュリティレビュー — TCG ROYAL

実施日: 2026-09-28 / 対象コミット: `7f3d279ffac47950be0bac42fa5cbcb47347bf3a`

> 以下は修正前のレビュー記録。2026-09-29にコード・DB・本番設定を修正した。最新の反映結果と残る運用上の制約は [修正報告](SECURITY_FIXES_2026-09-29.md) を参照。

免許証画像を取り扱うサービスとして、優先修正が必要な問題がある。特に、注文作成の過剰な入力受け入れ、プロフィールの機密管理列に対する書き込み権限、本人確認画像の削除・監査の失敗処理を先に修正する。本レビューは漏えいの発生を確認したものではない。

## 範囲と限界

- Next.jsの認証・Server Actions・API・管理画面、SupabaseのSQLマイグレーション/RLS/Storage/Edge Function、メール・ログ・外部画像取得、依存関係、Vercel設定ファイルをレビューした。
- 実コードの関数をTypeScriptから変換し、DB・認証・メールをモックに置き換えて注文作成とKYC APIの問題を再現した。実データの作成・更新・削除、実メール送信、攻撃ペイロードの本番送信は行っていない。
- 本番デプロイとこのコミットの一致は未確認。Vercelコネクタのチーム一覧が空で、プロジェクト設定の取得に必要なteamIdを得られなかった。ローカルに`.vercel/project.json`もない。
- `.env.local`のサイトURLはlocalhost。本番ドメインの特定には使えなかった。そこに設定されたSupabaseへのバケットメタデータの読み取りも`fetch failed`となった。本番RLS、GRANT、Storage公開設定、Auth設定、WAF、環境変数、監査ログは未確認。
- SQLの指摘はリポジトリのマイグレーションが適用され、対象ロールにテーブル操作権限がある場合のもの。本番で追加の制限がある可能性は残る。
- アプリ・SQL・依存関係の修正やデプロイは行っていない。既存の未追跡ファイル`COLLECTORS_REPUBLIC_PRICE_RPC.md`は変更していない。

## 優先修正事項

### F01 高: 注文作成の入力で所有者・金額・ステータスを上書きできる

根拠: `app/actions/orders.ts:233–244`、呼び出し元`app/cart/CartForm.tsx:1366`、`app/orders/new/NewOrderForm.tsx:62`。

`createOrder`はservice_roleでINSERTするオブジェクトの最後に`...bankInfo`を展開する。TypeScriptの引数型は実行時の入力検証ではないため、認証済みユーザーが余分なプロパティを送ると、先に設定した`user_id`、`status`、`total_amount`、`coupon_amount`等が上書きされる。RLSもservice_roleには効かない。

実関数のモック検証で、ログインユーザーとは異なる`user_id`、`pending_transfer`、合計999999、クーポン額500000がINSERTに渡ることを確認した。別ユーザーIDには実在ユーザーを指すなどDB制約を満たす必要がある。自分の注文の金額・状態改変には他人のIDは不要。外部振込の実行までは確認していない。

修正: 実行時スキーマで入力を検証し、銀行情報の許可したフィールドだけを一つずつ取り出す。所有者・状態・金額・クーポンはサーバーで確定する。未知のキーを拒否する。注文と明細の保存も単一トランザクションにする。

検証: 一般ユーザーから余分な管理列を送っても拒否され、別所有者・任意金額・任意状態が保存されないこと。

### F02 高: 本人確認済みフラグの自己変更と、他人の画像削除につながる信頼境界の欠落

根拠: `supabase/migrations/001_init.sql:37–43`、`app/mypage/profile/actions.ts:122–160`、`app/cart/actions.ts:95–131`。

profilesのINSERT/UPDATEポリシーは所有者だけを制限し、`identity_verified`や`id_image_url`の列を保護しない。後続マイグレーションにもこの列の変更禁止がない。通常の書き込みGRANTがある場合、一般ユーザーはData APIから自分の本人確認済みフラグを変更できる。

さらに、プロフィール/カートの画像更新処理はユーザーが変更できる`profiles.id_image_url`を信頼し、そのパスをservice_roleで削除する。被害者のUUIDと画像拡張子等からパスを知っている場合、自分のプロフィールに被害者の画像パスを設定し、自分の画像を再提出することで、その画像を削除させられる構造。UUIDを無条件に取得できるとは判断していない。画像の読み取りが可能という指摘でもない。

修正: 本人確認状態・画像参照をユーザー更新可能なプロフィールから分離するか、テーブル単位GRANTを撤回したうえで列単位GRANTを設定する。プロフィールINSERTも保護する。削除対象はservice_roleのみが更新する`identity_documents`から取得し、所有者とパスを照合する。単なる画面項目の非表示では防げない。[Supabase列単位権限](https://supabase.com/docs/guides/database/postgres/column-level-security)

検証: ユーザーAが自分の管理列をPATCH/INSERTできないこと。Aのプロフィールに不正参照が残っていてもBのStorageオブジェクトを削除しないこと。

### F03 高: Data APIから注文・明細を直接作成し、業務検証を迂回できる

根拠: `supabase/migrations/001_init.sql:96–98,124–133`、`013_order_assessment_workflow.sql`、`016_coupons_and_review_request_email.sql`。

ordersのINSERTは`auth.uid() = user_id`だけ、order_itemsのINSERTは親注文の所有者だけを確認する。通常のINSERT権限がある場合、任意の有効な状態・金額・クーポン額で自分の注文を作れ、既存の自分の注文にも任意価格・査定価格の明細を追加できる。カード価格検証、クーポン検証、レート制限、通知を通らない。F01を直すだけではこの経路は残る。

修正: 現在のサーバー経由作成に統一するなら、ユーザーロールのorders/order_items INSERT権限・ポリシーを撤回する。あるいは価格・所有者・状態をDB内で検証する限定RPCを設ける。

検証: 一般ユーザーの直接INSERTを拒否し、正規の申込は成功すること。査定済み注文への明細追加も拒否すること。

### F04 高: Next.jsの既知脆弱性を含むバージョンを固定している

根拠: `package.json:19`、`package-lock.json`。Next.js 16.2.6、sharp 0.34.5、postcss 8.5.15、ws 8.20.1。

2026-09-28の`npm audit`では全体14パッケージ（critical 2 / high 8 / moderate 2 / low 2）、`--omit=dev`では6パッケージ（critical 1 / high 4 / moderate 1）が報告された。これは脆弱なパッケージの集計で、本番で悪用可能な脆弱性の件数とは異なる。

- App Router + Server ActionsのDoSは、このアプリの構成が影響条件に該当する。修正版は16.2.11以降。[Next.js公式アドバイザリ](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj)
- AVIF画像最適化のRCEは16.3.3で修正。許可された画像の供給経路・実画像形式・Vercel画像最適化基盤に依存し、本番での成立は未確認。免許証バケットは`next/image`のremotePatternsに含まれないため、「免許証をアップロードすれば即RCE」とは評価していない。[Next.js公式アドバイザリ](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4)
- Windowsホスト限定RCEをVercel本番の脆弱性として扱わない。Windows開発機では別途該当性を確認する。[Next.js公式アドバイザリ](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
- Vite/Vitest等の開発依存の指摘を、そのまま本番アプリの侵入経路とは評価していない。

修正: auditが提示したNext.js 16.3.6等の修正版への更新を検証し、eslint-config-nextも整合させる。lockfileを更新してauditを再実行する。postcss/wsのoverrideも確認する。ビルド、認証、画像表示、申込フローを確認して再デプロイする。

### F05 高: 画像削除失敗を無視して「削除成功」にする

根拠: `app/api/admin/kyc/[documentId]/route.ts:125–152`。

Storage削除の`error`を確認せず、メタデータに`deleted_at`を付けて成功を返す。メタデータ更新・プロフィール更新・削除ログのエラーも無視する。原本が残っているのに画面では削除済みとなり、再試行も410で拒否される。

実GET/DELETEハンドラのモック検証で、Storageが削除エラーを返してもDELETEがHTTP 200 / `{success:true}`になることを確認した。

修正: 各段階の失敗を判定し、未完了の削除を追跡・再試行できる状態モデルにする。StorageとDBは一つのDBトランザクションでは原子化できないため、冪等な削除ジョブと照合処理を設ける。存在しないオブジェクトと通信・権限エラーを区別する。

### F06 中: 監査ログに失敗しても本人確認画像を閲覧できる

根拠: `app/api/admin/kyc/[documentId]/route.ts:67–83`。

閲覧ログINSERTの結果を確認せずsigned URLを発行する。モック検証でログ失敗時もHTTP 200と署名URL発行を確認した。画像へのアクセス記録が欠落する。現在のログは「URL発行」であり、そのURLを使ったすべての閲覧を記録するものでもない。

修正: ログが保存できなければURLを発行しない。成功した発行、失敗、削除、審査を区別する。signed URL返却に`Cache-Control: private, no-store`を付け、履歴・キャッシュに残る画像の扱いも設計する。URL有効期限5分だけでは、取得済み画像やブラウザ履歴は消えない。

### F07 高: メールアドレスの所有確認を省略している

根拠: `app/register/actions.ts:77–82`。

未認証の登録処理がAdmin APIで`email_confirm: true`を指定する。メールを受け取れることを確認せず、他人の未登録アドレスでアカウントを作成・ログインできる。通常の確認メール設定を有効にするだけでは、このAdmin API経由の処理は保護されない。既存アカウントを即座に乗っ取れるという意味ではない。

修正: 通常のメール確認フローに変更し、確認前の注文・本人確認提出の権限を制限する。登録後の本人による復旧や同一アドレスの先取りも想定してテストする。

### F08 中: 新規登録で本人確認メタデータが作成されず、原本が管理対象から漏れる

根拠: `app/register/actions.ts:92–169`、`supabase/migrations/007_kyc_security.sql:73–81`、`app/admin/(protected)/users/page.tsx:145–149`。

登録処理はStorageとprofilesだけを書き込み、`identity_documents`を作成しない。マイグレーションのバックフィルは適用時点の既存データだけが対象で、後からの登録は拾わない。新規登録時の免許証は専用閲覧・削除APIで使用するdocumentIdを持たない。プロフィール保存/サインイン失敗時にもAuthユーザー削除だけを試み、アップロード済み画像を明示的に削除しない。Auth削除の成否も未確認のため、常に正常に後始末される保証がない。

修正: 本人確認の保存処理を共通化し、Storage保存とメタデータ作成の失敗補償を実装する。既存の孤立ファイルを一覧化・照合し、確認した保持方針に沿って処理する。自動で一括削除しない。

## 追加の問題・強化事項

### F09 中: Vercelで共有されないレート制限と、直接Storageアップロード

根拠: `lib/security/rateLimit.ts:23`、`app/cart/actions.ts:77`、`app/mypage/profile/actions.ts:109`、`supabase/migrations/007_kyc_security.sql:58–65`。

制限カウンターはプロセス内Mapなので、別インスタンス・コールドスタートで共有されない。プロフィール画像更新にはこの制限自体がない。またauthenticatedは自分のフォルダに任意名の新規オブジェクトを直接作れる。1ファイル5MBの制限はあるが、ファイル数やユーザー別総量の制限はない。メタデータに載らないファイルの蓄積も可能になる。

対策: 共有ストアによるIP+ユーザー単位制限、Supabase Auth側の保護、Vercel Firewallを組み合わせる。ブラウザ直接アップロードが不要ならStorage INSERTポリシーを撤回する。必要なら許可したオブジェクトと使用量を管理する。本番WAF設定は未確認なので、現時点で無制限とは断定しない。

### F10 中: KYC審査者のMFA強制がない

根拠: `app/actions/auth.ts:36–79`、`app/api/admin/kyc/[documentId]/route.ts:11–25`。

アプリはパスワード認証とadmin_users.roleを確認するが、MFAの`aal2`を確認しない。アプリ層ではパスワードだけのセッションで画像URLを発行できる構造。Vercel/Supabase管理コンソールのMFAとは別の論点。

対策: KYCの閲覧・削除・審査にMFAと必要に応じた直近の再認証を要求する。一般管理者も`setIdentityStatus`で確認済みにできるため、画像閲覧と承認を同じ審査者に限定する運用なら、`app/admin/(protected)/users/actions.ts:41`の権限も揃える。[Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)

### F11 中: KYCメタデータが本番ログに出る

根拠: `app/cart/actions.ts:120,141,158,180`。

元ファイル名、ユーザーID、Storageパス、書類種別、アップロード日時を無条件にconsole出力する。画像本体や署名URLのログ出力はここでは確認していないが、本人確認に関するメタデータをVercelログおよびログ転送先へ増やしてしまう。

対策: 本番の詳細デバッグ出力を除去する。必要な相関ID・成功/失敗コードだけを記録し、DBエラーオブジェクト全体の出力も見直す。既存ログの保存期間とアクセス権を確認する。

### F12 中: ログイン後のnextパラメータで外部へリダイレクトできる

根拠: `proxy.ts:9–19,107–109`。

`/`で始まり`//`で始まらないことだけを検査するため、スラッシュとバックスラッシュで始まるパスが通る。NodeのURL正規化では、`/\\example.invalid/path`をベースURLに解決すると`https://example.invalid/path`になることを確認した。ログイン済みユーザーが細工したlogin/registerリンクを開くと外部遷移する。これだけでCookieが外部へ送信されるとは判断しない。

対策: URLを正規化後にoriginが自サイトと一致するか確認し、バックスラッシュ・制御文字を拒否する。類似のsafeDestination関数を共通化して検証する。

### F13 中・環境依存: Edge Functionが呼び出し元を認可しない

根拠: `supabase/functions/fetch-reference-prices/index.ts:184`。

ハンドラがRequestを受け取らず、常にservice_roleで価格取得・DB書き込みを実行する。Next.js cronはCRON_SECRETを確認するが、Supabase Function URLへの直接呼び出しはそれを通らない。ゲートウェイが通常の有効JWTだけを確認する設定なら、通常ユーザーやlegacy anonキーによる直接起動を排除できない。本番Functionのゲートウェイ設定は未確認。

対策: スケジュール処理専用のサービス間認証をFunction自身で検証し、一般ユーザーのトークンでは拒否する。失敗・再試行・同時起動にも制限を設ける。[Supabase Function認証](https://supabase.com/docs/guides/functions/auth)

### F14 中・管理権限が前提: 外部画像取得のSSRF/容量制限が不完全

根拠: `lib/security/safeRemoteFetch.ts:112–174`、`app/admin/(protected)/cards/actions.ts:177–217`。

事前DNS lookupとfetch側のDNS解決が別で、接続先IPを固定していないため、DNS rebindingの余地がある。またfetchがヘッダーを返した時点でタイマーを解除し、その後`arrayBuffer()`で全体を読み切ってから5MB制限を確認する。Content-Lengthを省略/偽装した応答や終わらないbodyに対する制限にならない。一般ユーザーにこの機能の権限があるとは判断していない。

対策: 許可する画像ホストを限定するか、検証済みIPへの接続を保証する仕組みを使う。bodyをストリーミングで読み、上限超過・全体タイムアウトで切断する。

### F15 低〜中・運用依存: 管理ドメイン制限がすべての管理機能に及ばない

根拠: `app/api/orders/route.ts:23–62`、`app/api/orders/[id]/route.ts:30–51`、`app/actions/orders.ts:334–364`。

`/api/orders?admin=true`と注文詳細APIの管理者分岐にはADMIN_ALLOWED_HOSTSチェックがない。`updateOrderStatus`にもホスト検査がない。管理者の認証自体は検証されるため、匿名の情報漏えいではない。しかし「専用ドメインのみから管理操作」という運用境界は一貫していない。

対策: 管理権限・許可ホスト・必要なMFAを共通のサーバー認可関数にまとめ、全管理経路に適用する。Host制限を認証の代わりにはしない。

## その他の改善候補

- 画像検査はファイル名/MIME宣言ベースで、画像実体・寸法・EXIFを検査していない。安全に処理できるデコーダで形式を確認し、機密画像のEXIF削除と上限を検討する。悪意あるファイルが直ちにXSS/RCEになるとは確認していない。
- `next.config.ts`にCSPがない。管理画面を含めReport-Onlyから導入し、スクリプト・接続先を制限する。CSP欠如だけをXSSの存在と判断しない。
- `lib/supabase/admin.ts`に`server-only`がない。現在の確認範囲ではservice_roleキーのクライアント露出は見つからなかったが、将来の誤importをビルド時に止める。
- CSV出力`app/api/admin/reference-prices/export/route.ts:23`は引用符等を処理するが、外部サイト由来の名称が`=`等で始まる場合の数式化を防がない。表計算アプリで開く運用なら対策する。
- 注文の状態変更は読んだ状態をUPDATE条件に含めず、複数テーブルの更新もトランザクション化されていない。同時の取消/承認/管理操作で不整合が起こりうる。DBトランザクション・条件付き更新・冪等性を導入する。
- プロフィールの氏名・住所を変えても画像を再提出しなければ本人確認済みフラグが維持される。変更時に再審査が必要な項目を決める。
- 確認した価格ビューはsecurity_invoker未指定だが、元テーブルも公開を意図した参考価格であり、本人確認漏えいとは評価していない。公開境界の意図を明記する。

## 確認できた防御

- マイグレーション上、identity-imagesは非公開・5MB上限・MIME制限あり。
- KYCメタデータは本人のSELECTだけ、監査ログは一般ユーザー用ポリシーなし。画像のSELECT/UPDATE/DELETEも一般ユーザーに許可していない設計。
- KYC APIはgetUserとDB上のkyc_reviewerロールを検証する。署名URLは5分期限でDB保存しない。
- 注文参照APIは一般ユーザーのuser_idを絞り、管理者分岐もadmin_usersを検証する。
- 注文の標準経路はDBからカード価格を再取得する。ただしF01/F03で迂回できる。
- メールテンプレートにHTMLエスケープ、主要応答にnosniff/X-Frame-Options等がある。
- 現在Git管理対象のテキスト178ファイルを限定パターンで秘密鍵・service_role JWT等の候補検索し、該当なし。Git履歴、ビルド成果物、全種類の秘密情報を網羅した検査ではない。

## 実施した検証

| 検証 | 結果 | 限界 |
|---|---|---|
| 既存`npm test` | 7ファイル / 60件成功 | 今回の権限問題を網羅しない |
| 実createOrder + 認証/DBモック | user_id/status/total_amount/coupon_amountの上書きを再現 | 本番DBへのINSERTはしていない |
| 実KYC GET + 監査失敗モック | ログ失敗でも署名URL発行・200 | 実際の画像取得なし |
| 実KYC DELETE + Storage失敗モック | 原本削除エラーでもsuccess:true・200 | 実際の削除なし |
| URL正規化 | バックスラッシュによるorigin変更を確認 | 本番ブラウザ試験なし |
| npm audit / omit=dev | 全体14 / 本番依存6のパッケージ警告 | 実到達性は個別評価が必要 |
| 本番Vercel/Supabase設定 | 未確認 | 上記接続・特定の制約あり |

## 本番で次に確認する項目

1. 本番Vercelのデプロイコミット・lockfile・実行環境をこのレビュー対象と照合する。
2. Supabaseでprofiles/orders/order_itemsの実GRANT・RLS・トリガーを確認する。テスト用ユーザーA/Bで権限境界を検証する。
3. identity-imagesの実際のpublic設定、storage.objectsの全ポリシー、旧バケット/複製/孤立ファイルを確認する。実免許証ではなくダミー画像で、匿名・所有者・他人・通常管理者・審査者を検証する。
4. VercelのProduction/PreviewのSupabase接続先と秘密鍵スコープ、Preview保護、旧デプロイ公開、Git連携権限、WAFを確認する。
5. Supabase Authのメール確認・登録可否・MFA・CAPTCHA/制限・リダイレクト許可先・セッション失効方針を確認する。
6. ログ転送先と保持期間、画像閲覧ログの保存成功/改ざん耐性、削除失敗アラートを確認する。
7. 本人確認画像の保持期間と削除対象を決め、DBバックアップだけでなくStorage原本の復旧手順を確認する。法的な保持義務の結論は本レビューの対象外。
8. F01〜F08の修正を先行し、テスト環境で直接Data API・Server Action・Storageを含め再検証してから本番へ反映する。
