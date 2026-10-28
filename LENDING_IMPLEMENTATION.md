# 担保融資アプリ: ローカル業務フローとモバイル実装

## 現在の構成と本番からの分離

2026-10-27更新（Android v1.3.0 / versionCode 5）:

- PSA公式API照会→スニダン商品候補→PSA10実価格→参考額→査定依頼→マイページ/管理者一覧。
  PSAトークンはPreview Secretへ登録済み。実APIはサンプル `167034272` にHTTP 403 / application/jsonを返し、鑑定情報は未取得。アクセス制限は回避していない。
  公式照会に成功した場合だけ `verifiedBy=psa_api` とする。手入力経路は `user_entered` と表示し自動の融資見積もりを発行しない。
- マイページに全契約の残高/返済額/直近期限、プロフィール編集・競合検出、査定依頼履歴。
- 本人確認は免許証の表裏アップロードを主経路とし、Previewだけ有効化。両面の最新画像とプロフィール版を照合する。
  JPKIは将来対応。Firebase SMSと書類審査は別の状態として管理する。
- 端末内5秒後通知とFCMの自己宛てプッシュAPI。Firebaseの端末設定・Previewサーバー設定は登録済み。実配信は未検証。
- 追加マイグレーション `20261026095312_lending_mobile_features.sql` を指定Previewだけに適用済み。
  全追加テーブルにRLS、公開ロールへのテーブル/RPCアクセスを撤回、private画像bucketにrestrictive policy。
- `scripts/test-lending-mobile-preview.mjs` により、Previewからスニダン実検索/価格取得、査定依頼、所有者/管理者表示、取消、
  非公開の免許証表裏保存・監査閲覧・テスト承認・削除、Firebase/FCM未設定のエラーまで検証済み。PSA実照会・SMS実配信・実プッシュ受信は設定待ち。
  検証記録はGit対象外の `output/android/mobile-preview-verification.json`。

`/lending` に利用者・管理者の業務画面、`mobile/` にReact Native / Expoの利用者アプリを追加。
両方が `/api/lending/workflow` と同じPostgreSQL業務関数を使う。
共有するカード・会員データと、専用の融資・担保・同意・台帳データを分離した。

**新しい業務APIはローカル開発と専用Preview設定に限定する。** ローカルは明示的な有効化、開発モード、ループバックDB・HTTPホストが必要。
Previewは `VERCEL_ENV=preview` と専用DB・認証設定がすべて必要。本番Vercelと既知の本番DBは拒否する。
既存の `.env.local` を書き換えず、起動スクリプトの子プロセス内だけ架空のキーとローカルURLに差し替える。
外部メール・銀行・JPKIサービスは呼び出さない。Firebase接続後はAuth/FCMを使用する。本番リリース・本番DBへの適用は行っていない。

### ローカルで動く業務

- 確認済みの商品対応表、価格スナップショット、15分有効の概算をDB保存。
- PSA QR URL・番号入力、成人プロフィール確認、郵送/店頭の申込。
- 同じPSA個体の二重受付・顧客合計1,000万円超の予約を防止。
- 現物検品・保管場所登録、到着後の再査定、条件提示、顧客の明示的同意。
- 条件を変更した場合は以前の同意をクリアし、再同意を必要とする。
- 出金記録、元本・利息・期限、振込済み申告、管理者の入金照合・差し戻し。
- 完済後の返却、預入済みキャンセル時の返却待ち、質流れの手動確認。
- 延長申請と同意内容の固定、3か月分の利息入金後の延長。金利0の場合は現金台帳を増やさず延長。
- 追加借入は相談申請の受付と見送りまで。元本を増やす実行は未実装。
- 元本・金額の整数円処理、行ロック、バージョン照合、冪等キー、照合番号の一意制約。
- 台帳・見積もり・イベント・コマンド受付記録の改変/削除禁止。
- 条件提示・同意時の条件スナップショットをイベントへ保存。
- 延長/追加申請の同意内容は変更できず、状態だけ完了/見送りに進める。
- 本人情報変更で融資用の本人確認を失効させ、条件提示/出金を保留。

### 起動

Node.js 24とDocker Desktopが必要。リポジトリのルートで:

```powershell
npm run dev:lending
```

表示されたURLの `/lending` を開き、右上で利用者・管理者を切り替える。
架空の会員・本人確認・カード・価格で動く。実際の送金ではなく、台帳への記録だけを行う。
テストDBとREST APIはセッションごとに新しいDockerコンテナを作り、終了時に削除する。
ローカルデータは永続保存しない。ホストされたPreview DBの設定は次節の条件を満たす場合だけ有効。

### Android / Vercel Preview

Androidの手順と検証範囲は `mobile/README.md` を参照。
Vercel Previewが実際に参照するDBは診断用Previewの `/api/lending/environment` で確認済み:
`mkmkkkdserlcaycknuxp`（TCG Royal組織）。ユーザーによるDB再開後、Previewに融資マイグレーションを適用済み。
既存の共通回数制限関数がなかったため `20260928142228_security_hardening.sql` の
`security_rate_limits` テーブルと `consume_security_rate_limit` 関数の部分だけを追加した。
その他の未適用マイグレーションを一括適用してはいない。適用前のpublicスキーマ・データをGit対象外のローカルファイルへ保存済み。
このPreviewには既存の `supabase_migrations.schema_migrations` がなく、SQLで管理された基盤だった。
今回も指定ファイルを明示して適用した。将来CLIによる一括適用へ移行する前に、既存スキーマと履歴のベースライン整備が必要。
新規に作成した架空会員2名・テストカード1件だけを使い、既存会員や既存カードのデータは変更していない。

業務用の環境変数はPreviewスコープだけに設定する。既存のSupabase設定へのフォールバックはない。

- `LENDING_WORKFLOW_ENABLED=true`
- `LENDING_PREVIEW_DB_REF` / `LENDING_PREVIEW_SUPABASE_URL` / `LENDING_PREVIEW_SUPABASE_SERVICE_ROLE_KEY`
- `LENDING_PREVIEW_SESSION_SECRET`（32文字以上の乱数）
- `LENDING_PREVIEW_CUSTOMER_ID` / `LENDING_PREVIEW_ADMIN_ID`（別々の架空テスト会員）
- `LENDING_PREVIEW_CUSTOMER_CODE_HASH` / `LENDING_PREVIEW_ADMIN_CODE_HASH`（別々のランダムコードのSHA-256）
- `LENDING_MARKET_FIXTURE=true`（まず架空価格で手続きを検証）

接続コードはサーバーで検証し、ロール・会員・DBを固定した2時間の署名付きセッションを発行する。
任意のロールヘッダーはPreviewでは無効。顧客と管理者のコード・会員IDを共用できない。
VercelのDeployment Protectionを維持し、共有トークンやDB秘密鍵をAPKに組み込まない。
HTTPからの共有URL/Cookie交換、役割別接続、申込→返却は `scripts/test-lending-preview.mjs` で成功済み。
検証は `RUN_LENDING_PREVIEW_TEST=1` を明示し、Git対象外のローカル接続ファイルがある場合だけ実行できる。
実行ごとにPreviewへ架空の申込・完済履歴を追加する。検証記録は `output/android/preview-verification.json`。
実機からの共有URL/Cookie交換・カメラ操作は端末接続後の検証が必要。

Previewの既存基盤について、DB advisorsは価格参照ビュー3件のsecurity definer、既存関数のsearch_path/
公開EXECUTE、漏洩パスワード防止未設定を報告した。新規の融資オブジェクトに対するWARN/ERRORは0件。
融資テーブル8件のRLSと、anonによる融資・価格スナップショット・台帳の直接読み取り拒否を確認済み。
既存基盤の診断指摘は別途対応が必要で、本番対応済みと解釈しない。

マイグレーションは `supabase/migrations/20261026050930_lending_workflow.sql`。
CLIでファイルだけを生成し、適用・検証は使い捨てDocker DB内で行う。
既存の全マイグレーションを先に適用するため、既存基盤との整合性も検証できる。

## 検証コマンド

```powershell
npm test
npm run lint
npm run build
npm run test:security:db
npm run test:lending:db
npm run test:lending:flow
```

`test:lending:flow` はNext.jsをループバックで起動し、HTTPページとAPIから実際のローカルPostgREST/
PostgreSQLまで確認する。概算→QR URL→申込→検品→再査定→同意→出金記録→追加相談→延長→
入金申告/差し戻し→入金照合→返却を検証し、終了時に停止する。
`test:lending:db` は権限、価格低下時の上限、同意の失効、個体予約、金利0、期限、
証跡の不変性、合計上限に加え、独立した2接続から同時に出金する競合を検証する。

ブラウザの実操作はComputer Useが現在URLを判別できず停止したため未完了。
Web画面の入力・同意・再試行はTesting Libraryで検証している。
Android APKのビルドは成功。実機カメラ、OS権限画面、IPAビルド・ストア審査は未検証。

2026-10-26の検証結果: Vitest 207件成功、意図的に実接続テスト1件をスキップ。
既存のセキュリティ/保存期間DBテスト、新しい融資DBテスト、HTTP通し検証が成功。
ルートのLintはエラー0件、既存の `app/cart/CartForm.tsx` の警告1件。
Node.js 24でNext.jsの本番ビルドとモバイルの型検査・Android/iOS両方のJSバンドル生成が成功。
モバイルの依存関係・実機検証については `mobile/README.md` を参照。

## 既存の参考査定ページ

管理画面 `/admin/lending` で既存のPSA10カードとスニダン商品IDを選び、
PSA10の掲載価格・最新売買履歴・概算額を確認できる。
管理者ログイン後、メニュー「担保融資・査定」から開く。
買取価格の高い順に最大200件を表示する。
カードマスタの `public_uid` と既存の管理者認証を共有し、DB変更は不要。

価格取得はボタン操作時の1リクエスト。定期収集や公開APIへの転載は行わない。
APIは `POST /api/admin/lending/preview`。管理者ロール、同一Origin、
管理者ごと毎分6回の制限が必要。一般利用者やモバイル用のAPIではない。

## 価格取得と計算

- 取得先: `https://snkrdunk.com/v1/apparels/{id}/sales-history`
- クエリ: `page=1&per_page=20&condition_id=22`
- 2026-10-26の確認で、22はPSA10。各履歴の `condition` もPSA10か検証する。
- `minPrice` は掲載価格として扱い、売買履歴の価格とは区別する。
- 相対日時はそのまま表示し、絶対日時へ変換して集計しない。
- 最新20件は期間全体の取引件数ではない。流動性スコアは未確定。
- 参考額 = min(スニダン掲載価格×40%, TCG ROYAL買取価格×60%, 1,000万円)。
- 1,000円未満切り捨て。10万円未満は算出対象外。
- 買取価格は24時間以内、スニダン取得情報は5分以内のみ使用する。
- 自動承認なし。商品対応・現物・本人確認・契約は別途必要。
- LTV 40/50/60%の閾値関数は準備済みだが、完全な期間別件数を取得できるまで自動適用しない。

外部URLを入力にせず、固定ホスト、リダイレクト禁止、10秒タイムアウト、
256KB上限、JSONスキーマ検証を適用。認証情報の送信・アクセス制限回避・自動リトライなし。
取得失敗・応答変更・グレード不一致は査定を停止する。

このエンドポイントはサイト表示用の非公開仕様で、外部向け公式APIとしての
提供・継続性・利用許諾は未確認。継続運用・商用査定に使う範囲はSODAに確認する。
この `/admin/lending` プレビューでは価格スナップショットや概算結果をDBへ保存しない。
新しい `/lending` 業務フローは専用テーブルへ保存する。

## 次の実装

1. Firebase Previewプロジェクト作成・Android設定・Auth有効化後のSMS実接続。JPKIは将来対応。
2. モバイル実機でのQR・権限・画面復帰、銀行口座と配送先の確認。
3. 追加借入の再査定・変更契約・分割出金ごとの利息台帳、誤記録の訂正・二重承認。
4. 写真の保管、郵送追跡、銀行明細取込、通知、障害再送、一覧の検索/ページ送り、正式な契約書・質受証交付。
5. 取引件数の期間・網羅性・重複・取消の確認と流動性LTV。
6. 許認可・契約/保存期間・料金表示と利用条件を確認したうえで、将来の本番対応を別途行う。

実際の銀行送金・正式な契約締結・融資実行はこの段階の対象外。
既存の買取価格、買取申込、本人確認状態は更新しない。

## 検証

`npx vitest run __tests__/lib/lending` で査定境界と取得失敗を確認。
管理者APIの認可・Origin・入力検証もテストする。
実サイトへの接続は通常のユニットテストでは行わない。

明示的な実接続確認（PowerShell、リクエスト1回）:

```powershell
$env:RUN_SNKRDUNK_LIVE='1'
npx vitest run __tests__/lib/lending/snkrdunk-live.test.ts
Remove-Item Env:RUN_SNKRDUNK_LIVE
```

## 2026-10-26 Firebase電話番号認証・免許証対応

- Android Preview 1.2.0 (versionCode 3)。Firebase Auth / FCMを同一プロジェクトで使用する。
- RNFirebase app/auth 26.4.1（Expo 58のKotlin 2.2と互換）。27系のFirebase Android SDK 35はKotlin 2.4が必要だったため採用していない。
- `/api/lending/phone` はPreview限定。Google発行のID tokenをAdmin SDKで署名・issuer/audience・期限・失効・無効ユーザーまで検証。電話番号プロバイダーで直近10分以内に認証した利用者だけ初回接続を許可する。
- project IDとサーバー資格情報の一致を検証し、Auth Emulatorのバイパスは拒否。アプリにサービスアカウント鍵は含めない。
- Firebase UIDをプロジェクト単位でハッシュ化して専用Supabaseユーザーを作り、毎APIリクエストでもFirebase tokenとDBの紐付けを確認。ヘッダーやuser_metadataで管理者に昇格できない。既存会員・共有テスト会員への自動統合はしない。
- SDKが端末内でtokenを更新し、APIには最新ID tokenを送る。アプリの接続解除でFirebaseもサインアウトする。
- 日本の携帯番号をE.164へ正規化。Preview限定で、架空番号用の+1 650-555-0100〜0199も使用可。実SMSの配信成功・番号所有は設定前には主張しない。マイページの確認済み表示はPreview検証用と明示する。
- 本人確認は免許証の表裏を主経路へ戻した。画像は非公開bucketでEXIF除去・JPEG再エンコード。書類閲覧は監査記録付き60秒署名URL。
- 表裏の最新画像が同一プロフィール版で両方承認されるまで本人確認は完了しない。プロフィール変更・追加提出・確認済み書類削除で失効。Preview承認はtest_fixtureのまま、正式な本人確認と区別する。
- Firebaseプロジェクトtcg-royal-lending-preview作成済み。Android用google-services.jsonをv1.2.1 (versionCode 4)へ組み込み、LENDING_FIREBASE_PROJECT_IDはVercel Previewに登録済み。LENDING_FCM_SERVICE_ACCOUNT_JSONもPreviewへ登録済み。最新Previewで設定一致と不正ID tokenの拒否を確認。SMS/FCMの実配信は未検証。
- iOSも同じFirebaseプロジェクトに別アプリとして登録可能。Bundle ID com.tcgroyal.lending.preview。GoogleService-Info.plist、APNs、iOS署名とMac上のビルド検証は未実施。APKはAndroid専用。iOS用Firebase設定ファイルの読み込みとプロジェクト一致検査は用意済み。
- Next.js 16.4.3 / Zod 4.6.7へ更新。Firebase AdminはVercelのCommonJS実行環境に合わせ13.10.0を使用。Admin配下のuuidは互換APIを持つ11.1.1へ固定して既知の脆弱性を回避。Firestore/Cloud Storageは使用しない。
- 本番デプロイ・本番DB/Auth設定変更は行っていない。

## PSA実接続確認（2026-10-26）

Preview Secret登録と再デプロイを確認。公式APIのGetByCertNumber/167034272はHTTP 403（application/json）を返したため、PSA→スニダンの一貫検証は未完了。接続先・Bearerヘッダー・Origin/顧客認証を確認し、Bearer接頭辞と前後空白を正規化。秘密情報のヘッダー例外への混入を防ぐ形式検証、HTTPステータス別のエラー表示を追加。PSAトークン・上流応答本文はログに出さない。関連回帰11件成功、Previewビルド成功。本番変更なし。PSA公式テスト画面でも同じ番号を照会してHTTPステータスを比較する必要がある。

## Firebase Android設定（2026-10-26）

ユーザー提供のDownloads/google-services.jsonについて、プロジェクトtcg-royal-lending-previewとパッケージcom.tcgroyal.lending.previewの一致を確認。mobile/google-services.jsonへコピー（Git除外）。ExpoのFirebase app/authプラグインを適用してAndroidを再生成、型チェック成功。サーバー用の秘密鍵はこのファイルには含まれず、APKにも入れない。Firebase Phoneの有効化・テスト番号・署名登録・サーバー資格情報を接続後に実配信確認が必要。

Firebaseサーバー資格情報の登録後にPreviewを再デプロイ。設定一致、phoneConfigured/remotePushConfigured、偽ID tokenの401拒否を検証済み。記録はoutput/android/firebase-preview-verification.json（Git除外）。資格情報は取得・表示せず、APKにも含めていない。Phone有効化・テスト番号・署名登録、実際のSMS/FCM配達は実機で別途確認する。

## PSA利用上限の追加確認

ユーザー提供の公式テスト結果はHTTP 429、JSON文字列「API calls quota exceeded! maximum admitted 100 per Day」。提示curlはAuthorizationなしのため、登録トークンの枠とは区別する。既知の上限本文を403/429で識別し、1日100件の上限と再試行を控える案内へ変更。応答本文や秘密情報はログに出さない。関連13件テスト・Previewビルド成功。追加のPSA実照会は行わず、枠のリセット時刻も推測しない。

## 2026-10-27 文言整理・PSA再照会の節約

- モバイルとWebの「大切なコレクションを」「カードの価値を、次の選択肢に」などの宣伝文句を削除。「カード査定」「申込・契約」「融資管理」に整理。
- マイページ・SMSログイン・通知テストの開発事情や重複説明を短縮。テスト環境の表示、書類画像の注意、個人情報送信・融資条件への同意は維持。
- リリース版の初回起動では未接続APIへアクセスしない。ログイン前の不要なエラー、読み込み表示、下方向リフレッシュを抑止。
- 同一利用者・同一番号の公式PSA照会結果だけ24時間再利用。DBの有効期限と元の取得時刻を両方確認。手入力・未来時刻・別番号・期限切れは再利用せず、保存されたeligibleフラグも信用せずラベル情報から再計算する。
- 新しいDBテーブルや権限変更なし。PSA取得日時は更新せず表示し、価格は従来通り新たに取得する。PSA実照会の成功を模擬していない。
- 通知登録の実機限定条件を修正。Google Play対応AndroidエミュレーターでもFCM登録を試せる。実際の配達は別途確認が必要。
- v1.3.0はarm64-v8a/x86_64の共通APK。同じ署名・versionCode 5で以前の実機用・エミュレーター用の両方から更新できる。
- 単体230件成功（実APIオプトイン1件スキップ）、Web/Androidビルド成功。ローカルHTTP→PostgREST→DBの融資フローとPSAキャッシュの所有者・期限を確認。PSA/FCM/SMSの外部サービスは今回のテストで呼び出していない。
- WindowsのWebビルドは子プロセスもNode 24を参照するPATHで実行する。サンドボックス内ではTurbopackの子プロセスが起動できない場合がある。


### Android v1.4.0 navigation and environment tools

- Added fixed bottom tabs: 融資申請 / 貸付状況 / マイページ, with safe-area handling for Android/iOS.
- Loan commands, repayment amounts/deadlines and event history are now under 貸付状況; profile/license uploads remain under マイページ.
- Top-left テスト環境 button opens a modal containing Preview URL/code login, notification tests and legacy fixture applications. Normal screens no longer show test-qualified verification/contract labels.
- Preview protections, API authorization and synthetic-money behavior remain unchanged; no production deployment or database changes.
- App version 1.4.0, Android code 6 / iOS build 6.
- Windows native builds set CMAKE_OBJECT_PATH_MAX=240 through the Expo config plugin to hash long safe-area codegen paths; no global Windows settings are changed.


### Android v1.5.0 business inbox

- Footer now has 融資申請 / 貸付状況 / お知らせ / マイページ. Notification tests remain in the environment tools modal.
- App inbox is derived from authenticated workflow events, current document/assessment states, and active-loan due dates. No fabricated business messages or push-test history. Document dates explicitly denote submission dates, not approval dates.
- Active loans generate in-app reminders at 7 days, 3 days, and overdue. Reminder IDs include loan ID, due timestamp and threshold; repayment reconciliation and closed loans suppress reminders. This does not add background push delivery.
- Individual/all read actions and unread filtering/badge; receipt IDs only are saved locally with AsyncStorage, scoped by hashed Preview origin and login identity. No authentication tokens, codes, message bodies or profile information are persisted. Read status is not synchronized between devices. Code rotation or changing Preview origin creates a separate receipt namespace.
- Inbox links focus the matching contract; account messages open My Page. Only the recent records supplied by existing APIs are available (maximum 200 inbox items). No server schema or deployment changes.
- Version 1.5.0 / Android code 7 / iOS build 7. Eight inbox tests cover deadline boundaries, closed/reconciling loans, event IDs, source isolation and receipt validation; 15 existing auth/session tests pass.


### Android v1.5.1 dedicated release signing (Lookout remediation)

- Lookout's supplied report identifies the published/shared private signing key. All previously distributed APKs through v1.5.0 used Expo's shared Android debug certificate (SHA-256 fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c). This is a valid distribution-signing issue, not a confirmed behavioral malware finding.
- Replace release signing with a dedicated Preview-only RSA 3072 PKCS12 key. Private files live under ignored mobile/.signing-preview/, outside generated native folders. Never upload keys/passwords or include them in APKs.
- Expo's config transformation now requires dedicated release signing; no debug fallback. Generated release variant explicitly sets debuggable false. Local debug builds remain local-only.
- Version 1.5.1 / Android code 8 / iOS build 8. Existing APKs require uninstall/reinstall due to the changed certificate. Do not use shared-key signing lineage to preserve old updates.
- Register the new public SHA-1/SHA-256 in the Preview Firebase Android app for phone authentication. Corporate acceptance and Lookout rescanning require device/admin verification; signing alone cannot guarantee all enterprise policy requirements. No endpoint security/Intune policy weakening is performed.


### Android v1.5.2 phone login first-launch fix

- SMS submission reset previously called Firebase native signOut unconditionally. RN Firebase 26.4.1 Android rejects signOut with auth/no-current-user when no current user exists, preventing first-launch SMS submission.
- Skip signOut for an empty session; tolerate only the same no-current-user race, preserving all other failures. Add a Japanese message for this error in other auth phases.
- Four session-reset tests plus existing signing/phone tests pass (16 total); lint/typechecks and dedicated signing validation required. Version 1.5.2 / code 9, same dedicated Preview certificate as v1.5.1. No server/deployment changes.


### Android v1.6.0 remembered Preview access

- Default public origin is the existing protected Vercel Preview deployment; no shared-link secrets or login codes are compiled into the APK.
- Save connection URL/mode and code credentials in Expo SecureStore; Firebase bearer tokens remain managed by Firebase SDK. Restore on startup after Firebase auth hydration; refresh code sessions before their two-hour expiry with single-flight renewal. Maximum saved-access age is 30 days.
- Explicit logout removes the vault record; serialized secure-storage operations and a session generation guard prevent a delayed save/restore from resurrecting logged-out access. Existing inbox receipts stay in AsyncStorage.
- Vercel share-link expiration remains independent; a fresh link is required on expiry. Endpoint protection is unchanged. Startup avoids unauthenticated workflow requests and permits manual recovery after connection errors.
- Six validation/queue tests plus prior phone/signing tests pass (22 total). Device restart restoration remains unverified. Version 1.6.0 / Android code 10; existing dedicated Preview key retained.
- Handover generator now writes a private local guide and a separate Drive guide without credentials. Correct current SHA fingerprints replace obsolete debug fingerprints.


### Android v1.7.0 Supabase Auth

- Normal login now uses the same Supabase email/password model as the existing Web app, against the selected Preview project mkmkkkdserlcaycknuxp. Supabase IDs bind the existing profile and lending records; no email-based merging or production account copying.
- Signup requires email confirmation with the same minimum 12-character password policy. Password recovery uses a PKCE callback and custom scheme tcgroyal-preview://auth/callback. This must be allowlisted under the Preview Auth Redirect URLs; mail delivery and on-device callbacks remain unverified.
- SDK session/refresh tokens live in SecureStore using transactional chunks below 1800 UTF-8 bytes. Readers never observe incomplete writes; logout removes the manifest before old chunks. Passwords are never persisted. A distinct namespace isolates SDK tokens from Preview connection metadata.
- Native verifier entropy uses Expo Crypto. Where WebCrypto.subtle is absent, the supported custom-fetch adapter upgrades only first-party email PKCE requests to native SHA-256 s256; SDK getUser remains the authoritative network verification method. A real SDK request test verifies challenge/verifier binding without sending mail.
- Preview APIs verify JWTs using the same project's Auth getUser endpoint, reject unconfirmed/anonymous/non-user identities, and read administrator roles from admin_users rather than user_metadata. Enrolled MFA requires verified aal2. Existing Preview fixtures remain explicit test-only compatibility paths.
- Full unit suite 265 passed plus 3 native PKCE tests. Hosted integration passed password login, refresh, logout refresh rejection, invalid-token rejection, own-profile isolation, direct-RPC denial and editable-admin-metadata rejection. Both synthetic users were removed. No schema or production changes.
- Normal account screen displays confirmed login email. Phone verification is separately unconfigured for Supabase accounts and is not implied by email verification.
- API Preview: https://tcg-royal-9a2agk48s-collectorsrepublic.vercel.app (dpl_JDctygdav3miPCy9wTF3Gs6qBuXs). APK 1.7.0 / code 11, existing dedicated certificate retained.

- Final native boundary checks pin API credentials to the selected Preview origin and Auth requests to the configured Supabase origin. Credentialed requests do not follow redirects; only the credential-free Vercel share bootstrap may follow its exchange redirects. MFA assurance checks use a current verified token to refresh factor enrollment status. Two additional origin-boundary tests pass.


## 2026-10-28 v1.7.1: native login / recovery error fix

- Reproduced the API response behind the distributed APK login failure against the selected Preview without a Vercel cookie: Vercel returned HTTP 401 JSON with a nested `error` object. The client used `Error(data.error)`, hiding the actual protection failure behind `[object Object]`. Supabase password login itself can succeed before this failure.
- Added bounded message extraction and explicit Vercel-protection handling to native API errors, plus readable recovery errors. Do not stringify complete service payloads or persist credentials in diagnostics.
- Password recovery now acknowledges successful password persistence before attempting the separate workflow API connection. A later Preview connection error no longer makes the password update appear to have failed.
- Applied `alias-protection-override` only to Preview deployment `dpl_JDctygdav3miPCy9wTF3Gs6qBuXs` (`tcg-royal-9a2agk48s-collectorsrepublic.vercel.app`). Supabase/JWT authorization remains required. Project SSO settings and production deployment ID/URL were compared before/after and are unchanged. No database migration or production deployment performed.
- `scripts/test-lending-supabase-preview.mjs --without-vercel-cookie` passed actual password login, account/API identity binding, spoofed-admin rejection, ownership/RLS isolation, invalid-token rejection, recovery-token password update, old-password rejection, new-password login, token refresh, logout/revocation. Both synthetic users were deleted; no mail sent. Evidence: `output/android/v171-auth-integration.json`.
- Added regression coverage for the exact Vercel nested-error payload and the real SDK PKCE recovery sequence (s256 request, code exchange, PASSWORD_RECOVERY event, authenticated password update). These tests do not replace on-device email/callback verification.
- User reports the callback redirect allowlist was configured. Mail delivery and on-device email deep-link flow remain unverified.


## 2026-10-28 v1.8.0: brand icon and individual support estimates

- Reused the existing TCG ROYAL crown from `app/favicon.ico` for iOS, Android legacy/adaptive/themed icons, splash artwork and web favicon. Native version 1.8.0 / build 13, same dedicated Preview signing certificate. No generated replacement brand artwork.
- Added an individual estimate route for ungraded cards, missing/unknown PSA numbers and unavailable automatic assessments. Available before login and in the assessment screen; no fake PSA number or PSA10 claim is needed.
- Card details and an optional requested amount produce a bounded, validated inquiry draft. On explicit consent and button press, the draft is copied and the existing official LINE URL (`https://lin.ee/Q6CsfJkl`, sourced from the TCG ROYAL website) opens. The user pastes, attaches card photos and sends in LINE. The app does not automatically message support, create a loan, claim receipt, or store these drafts in the database. The screen states that the support estimate and later application instructions are separate from a loan contract.
- Added pinned `expo-clipboard@58.0.4` (Expo58 supported version). No new database tables, storage buckets or backend routes needed.
- Updated APK default connection to the user's redeployed Preview `dpl_Fh6kjRFgKTmZLF4p6ABvSgEcw6vm`. Limited the Vercel authentication exception to that Preview. Migrates only the previously shipped project's saved URL and drops its old share query; arbitrary origins remain rejected. No production deployment, schema or settings changes.
- Focused tests cover inquiry validation and non-PSA requests, saved URL migration, service errors and PKCE recovery. Latest Preview account/environment connectivity verified without Vercel Cookie or any live PSA call. Evidence: `output/android/v180-preview-verification.json`. PSA itself remains limited/rejected upstream; this release does not claim that PSA access is restored.

- Native UI smoke test could not run: an isolated Android37 emulator remained offline on initial boot despite one memory-adjusted restart. It was stopped without modifying the existing AVD app/data. Device/LINE handoff testing is not claimed; launcher resource images were visually inspected and all native type/static checks passed.


## 2026-10-28 v1.9.0: persisted LINE support cases

- Added transactional `lending_support_cases` and immutable `lending_support_events` with service-only table/RPC access and RLS. Migration: `20261028043624_lending_support_cases.sql`; applied only to Preview `mkmkkkdserlcaycknuxp` via the explicitly targeted CLI Management API. The Preview has no existing `supabase_migrations.schema_migrations` table, so no unrelated migration history was fabricated or changed.
- App registration now requires a verified member session, saves the inquiry with an idempotency key and issues a unique TR reference. The registered inquiry and progress are visible under Loans. LINE handoff is a separate explicit action and includes the reference. Opening LINE never implies that a message was sent or a loan was approved.
- Admin UI: `/lending#support-cases` in the existing Preview administrator mode, linked from `/admin/lending` in Preview. Supports search, manual creation, unlinked-member cases, one-time staff-confirmed member binding, review/additional-info/estimate/decline/cancel operations and versioned public history. Staff-only contact labels are excluded from customer responses. No public reference-based claiming endpoint.
- Preliminary acceptance is performed by the owner, requires the adult profile, the declared amount/consent and the shared exposure limit, and creates a real loan record. Manual quotes explicitly have `source=support`, no invented card master/product/buy-price or PSA certificate. Existing inspection, final offer, owner consent, identity, disbursement ledger, repayment and return operations remain in force. Final manual offers require a fresh valuation, cap and written basis. Case display derives subsequent financial status from the linked loan to avoid two competing ledgers.
- Local PostgreSQL verified complete ungraded-card registration→review→estimate→owner application→inspection→manual final offer→owner consent→funding record→repayment→return, plus owner isolation, roles, idempotency, versions and no fabricated PSA data. Existing lending/profile/document/concurrent-funding regression suites passed. Lending unit suite: 180 passing / 1 live provider test skipped. Web and native TypeScript/static checks passed.
- Browser verified administrator manual creation, generated reference, review and estimate update on an isolated local DB. Screenshot: `output/android/support-case-manager.png`. Mobile device UI and real LINE messaging are unverified.
- Preview deployment: `dpl_7S4ubqpEcDxMbqRf5ismkyJjGdj1`, `https://tcg-royal-2u2kvw3cy-collectorsrepublic.vercel.app`, READY, develop branch, target Preview. Scoped authentication exception applied only to this deployment. Project/production settings were not changed.
- Preview API verified registration replay, role rejection, unlinked case privacy, estimate visibility, loan conversion, derived cancellation status and private staff memo removal. Two synthetic cases and the linked synthetic loan are closed; audit evidence is retained. No transfers, PSA calls or external messages performed. Evidence: `output/android/v190-support-integration.json`. Advisor baseline/current both 13 existing warnings, zero new warnings.


## Develop WIP workflow (2026-10-28)

The canonical test environment is now the Git-linked develop deployment:
`https://tcg-royal-git-develop-collectorsrepublic.vercel.app/admin`.
Push lending WIP snapshots to `origin/develop`; do not promote to Production or merge to main.
New mobile builds use the same stable origin and migrate only previously shipped project endpoints.
Already distributed APK v1.9.0 still contains its previous immutable Preview URL until updated.
Local credentials, private signing material, generated native trees/APKs, attachments, editor state and temporary scripts are excluded from Git.
Unrelated retention/security work remains local and is not part of the lending WIP snapshot.
