# TCG ROYAL mobile

## v1.12.1 接続診断（2026-10-29）

左上「テスト環境」→「接続診断」で、Supabaseへの通信・認証情報なしのアプリAPI到達・現在のログイン情報でのAPI取得を分けて確認する。
診断は12秒でタイムアウトし、会員のトークンやCookieを到達確認に送らない。認証付き確認は通常のAPI認証を使う。
DNS障害を期限切れやVercel保護と決めつけず、DNS・タイムアウト・HTTP応答を区別する。業務更新の自動再送は行わない。
画面更新時は以前の通信エラーを消去して新しい結果を表示し、マイページの初回取得失敗時にも再取得できる。
同一v1.12.0 APKのAndroidエミュレーターで、テスト会員の認証→カード一覧・マイページのAPI取得は成功した。利用者実機のDNS障害の原因は未確定。

## v1.12.0 APK（2026-10-29）

通常の査定は登録カードの検索・選択、画像からの候補検索、個別見積もりに統一。
旧PSA公式API検索・スニダン価格取得画面と、テストメニュー内の旧申込経路を削除した。
任意のPSA鑑定番号入力・QR読み取りも外し、鑑定グレードは自己申告として扱う。
過去の契約の鑑定番号は履歴として保持する。
Androidは専用Preview鍵によるrelease署名を必須とし、debug署名へフォールバックしない。
API接続先は `https://tcg-royal-mobile-preview-collectorsrepublic.vercel.app`。
この専用aliasは検証済みのdevelop Previewを指す。Web用develop aliasのVercel認証は維持する。
専用aliasでは融資API以外を404にし、業務APIはSupabase認証・所有者検証・回数制限を適用する。
以前の配布APKの接続先は同プロジェクトの既知URLのみ移行し、共有URLの古いクエリを引き継がない。
以下は旧バージョンを含む開発記録であり、このAPKの現行機能・接続状況は上記を優先する。

## 最新の検索仕様（2026-10-29）

カード検索は「共有DBから検索・選択」を基本とし、OpenAI画像解析による候補検索を追加する方針に改定した。PSA公式APIは通常の検索・申請フローから外す。未鑑定・DB未登録カード等は既存の個別見積もりで受け付ける。
詳細・受入条件は [LENDING_IMPLEMENTATION.md の現行仕様](../LENDING_IMPLEMENTATION.md#現行の検索申請仕様2026-10-29改定) を参照。新しい検索画面とAPIの初期実装はv1.10.0のソースに追加済み。以下の一覧は過去の実装記録を含む。既存の配布APKには未反映で、新しいバックエンドへの接続設定・実機確認が必要。

React Native 0.88 / Expo SDK 58 / TypeScriptによる利用者アプリ。
WebViewではなくネイティブの画面・カメラを使う。
ドメインの型とPSA番号パーサーは親リポジトリの `lib/lending` と共有する。

## 実装済み

- 「査定する」「マイページ」「通知」のタブ画面（v1.1.0 / versionCode 2）。
- PSA公式APIの番号検索アダプター、カード名・年・番号・グレード表示。自動検索には `PSA_API_ACCESS_TOKEN` が必要。
- スニダンの商品候補検索、番号照合、PSA10実価格からの参考額取得、査定依頼の保存・取消。
- 手入力ラベルは「PSA公式API未照会」と明示し、既存商品対応表があっても自動の融資見積もりを発行しない。
- マイページの現在融資額・返済必要額・直近の返済期限をサーバーで全契約から集計。プロフィールの編集と更新競合検出。
- 本人確認の主経路は画像不要のJPKI。事業者/API接続は未完了で、確認済みを偽装せず「接続準備中」として扱う。
- 端末内の5秒後通知、通知権限、端末設定へのリンク。FCM端末登録・自分へのテスト送信・受付/受信履歴のAPI。
- カード選択、概算取得、PSA QR読み取り・URL/番号入力、郵送/店頭の申込。
- 契約条件の表示と明示的同意、残高・期限・手続き履歴。
- 振込済み申告、延長の申請、追加借入の相談、申込キャンセル。
- 通信失敗時に同じ冪等キーを使う再試行。
- 公開キーやservice roleキーをアプリに入れず、業務APIだけを利用。

ローカルデモまたは明示的に構成したVercel Previewへ接続する。SMS/JPKI、本番の認証セッション、
FCM資格情報、実際の送金は未接続。端末内通知とリモートプッシュは区別して表示する。

## 外部接続の設定

- PSA: サーバーのPreview環境変数 `PSA_API_ACCESS_TOKEN`。ユーザーのサンプル鑑定番号は `167034272`。
  [公式API案内](https://www.psacard.com/publicapi)にログインし、[ドキュメント](https://www.psacard.com/publicapi/documentation)からトークンを生成。
  現行の料金・上限は発行画面の規約で確認する。公開公式ページでは明記を確認できていない。APK・Driveの手順書にトークンを入れない。
- JPKI: まずデジタル庁の認証API/4情報連携を候補として、適用できる本人確認要件と利用登録を確認する。
  自社アプリ側の実装は可能。J-LISへの直接の有効性照会や署名APIの検証には、認定・PF事業者連携の条件がある。
  [公式ガイド](https://developers.digital.go.jp/documents/auth-and-sign/implement-guideline/)を参照。未接続のまま本人確認を完了扱いにしない。
- リモート通知: `mobile/google-services.json`（パッケージ名 `com.tcgroyal.lending.preview`）を配置しAPKを再ビルド。
  サーバーのPreview Secretに `LENDING_FCM_SERVICE_ACCOUNT_JSON` を設定する。FCM HTTP v1へ直接送信するためExpoアカウントは不要。
  秘密鍵はモバイルへ含めない。FCMでの受付は端末への配達完了とは区別し、受信ACKを別途記録する。
- 補助書類の画像アップロードは `LENDING_DOCUMENT_UPLOAD_ENABLED=true` の場合だけ使える例外機能。
  現在は設定せず無効化している。専用のprivate bucketと所有者チェック、3MB上限、画像再エンコード、管理者閲覧ログを実装・テスト済み。
  画像アップロードやテスト承認をJPKI確認済みとして扱わない。

## AndroidにインストールしてPreviewで試す

検証用APKは `../output/android/tcg-royal-preview.apk`。arm64端末向けで、
パッケージ名は `com.tcgroyal.lending.preview`。内部テスト用のdebug証明書で署名する。
Metroサーバーは不要。USB接続・USBデバッグの許可後に次を実行する。

```powershell
adb install -r output/android/tcg-royal-preview.apk
```

起動後、案内されたVercel Preview URLと利用者用テスト接続コードを入力する。
Vercel認証で保護されたPreviewは、有効期限内の共有URLを使う。
アプリは共有URLをCookieへ交換し、接続コードで2時間の署名付き業務セッションを取得する。
コード・業務トークンは永続保存せず、アプリ再起動後は再入力する。
管理者操作はWebの `/lending` に管理者専用コードで接続して行う。

Preview DBの再開・マイグレーション・架空のテストデータ投入・専用環境変数の設定が必要。
現在選択されているDBは `mkmkkkdserlcaycknuxp`。再開後、必要な追加テーブル・回数制限関数と
架空の会員/カードを用意し、共有URL→Cookie→役割別接続→申込から返却までのHTTP実接続検証が成功した。
テストURL・接続コードはGit対象外の `../output/android/テスト手順.txt` を参照。
本番URL・本番Supabaseの設定は使わない。

## ローカル開発

Node.js 24を使用する。別ターミナルでリポジトリのルートから `npm run dev:lending` を起動し、
表示されたAPIオリジンを設定する。実際のポートは起動ごとに変わる。

```powershell
cd mobile
npm ci
$env:EXPO_PUBLIC_LENDING_API_URL='http://127.0.0.1:表示されたポート'
npm start
```

APIは安全のためループバック専用。Androidのエミュレータ/USB実機では、開発者が
`adb reverse tcp:表示されたポート tcp:表示されたポート` を設定してlocalhostへ転送する。
LANアドレスや本番のURLへ変更しても接続できない。
iOSシミュレータはMac上でバックエンドと共に動かす必要がある。
SDK 58に対応する開発ビルド/Expo Goを使用する。

## 確認

```powershell
npm run typecheck
npx expo export --platform android --no-bytecode --output-dir dist/android
npx expo export --platform ios --no-bytecode --output-dir dist/ios
```

Android/iOSのJavaScriptバンドル生成と型検査は確認済み。
Android APKのネイティブビルドは成功。実機カメラ、権限、キーボード、安全領域のレイアウト、
新機能の端末内通知の表示は実機未接続のため未確認。旧APKのインストールはユーザーが確認済み。IPAビルドは未確認。
APKはAndroid 7以降のarm64端末向け。署名検証済みで、マイク・外部ストレージ・画面重ね合わせ権限は含めない。
ブラウザによるWeb版はこの段階の検証対象外。

2026-10-26のnpm auditでは、Expo CLIの署名検証依存 `node-forge` に修正版未提供の指摘が残る
（直接パッケージを含め4件のhigh）。Zodの指摘は4.6.7へのoverrideで解消。
`npm audit fix --force` による古いSDKへのダウングレードは行わない。
本番配信前にSDK・依存関係を再確認する。
