# uwabami

呑んだお酒・呑みたいお酒を記録するWebアプリ。React + FastAPI + SQLite を Docker Compose（nginx / backend）で動かす。設計の経緯は [drink_app_plan.md](./drink_app_plan.md) を参照。

## 開発

```bash
task install
task dev
```

Vite dev server と uvicorn（`:8001`）が起動する。ブラウザでのE2E確認に関する注意は [CLAUDE.md](./CLAUDE.md) を参照。

## ログイン

Googleアカウントでのみログインできる（OpenID Connect の認可コードフロー + PKCE）。ログインできるのは `UWABAMI_GOOGLE_ALLOWED_ACCOUNTS` に `email=username` のカンマ区切りで列挙したアカウントだけで、ログイン後は対応する `users` テーブルのユーザーとして扱う。未登録のユーザー名は初回ログイン時に作られる。一覧から外したユーザーのトークンは、有効期限内でも拒否する。

[Google Cloud Console](https://console.cloud.google.com/apis/credentials) で OAuth クライアント ID（種類: ウェブ アプリケーション）を作成し、「承認済みのリダイレクト URI」に次を登録する。`UWABAMI_GOOGLE_REDIRECT_URI` はこれと完全一致させる。

- 本番: `https://uwabami.ts-soda.net/api/auth/google/callback`
- 開発: `http://localhost:5173/api/auth/google/callback`

## デプロイ

main に push すると自動でデプロイされる。

1. GitHub Actions（`.github/workflows/build-images.yml`）が backend・frontend・nginx のイメージをビルドし、`ghcr.io/tansanmilmil/uwabami-<service>:<コミットSHA>` を push する
2. venus の systemd timer（`uwabami-deploy.timer`）が2分ごとに `deploy/venus/pull-deploy.sh` を実行する。`origin/main` が前回デプロイしたコミットと違えば、そのコミットに `git reset --hard` し、イメージを pull して `docker compose up -d --no-build` で入れ替える
3. イメージがまだ無い（ビルド中・ビルド失敗）コミットは、コードを元に戻して次の回に再試行する

デプロイ済みのコミットは venus の `/home/alma/uwabami/.env` の `UWABAMI_IMAGE_TAG` に記録される。ログは `journalctl -u uwabami-deploy` で見る。本番DBをローカルに複製するときは `task db:pull` を使う。

イメージ名に付くタグは `UWABAMI_IMAGE_TAG` で決まり、未設定なら `local`。ローカルで `docker compose up -d --build` すると `:local` としてビルドされ、GHCR からは取得しない。

### ロールバック

venus で戻したいコミットを指定して入れ替える。main を戻さない限り、次に main が更新されたときに最新へ戻る。

```bash
cd /home/alma/uwabami
git reset --hard <sha>
UWABAMI_IMAGE_TAG=<sha> docker compose pull
UWABAMI_IMAGE_TAG=<sha> docker compose up -d --no-build
```

### venus の初回セットアップ

```bash
# 1. GHCR にログイン（read:packages だけを付けた classic PAT をパスワードに入力する。fine-grained PAT は GHCR で使えない）
#    nina-njaa のセットアップで同じアカウントでログイン済みなら不要
docker login ghcr.io -u TansanMilMil

# 2. rsync で置いていたディレクトリを git 管理に切り替える（db/ と logs/ は .gitignore 対象なので残る）
#    リポジトリは public なので、git fetch に認証は要らない
#    ~/uwabami/.env はデプロイ済みコミットの記録に使うので、残っていれば中身を確認してから消す
cd /home/alma/uwabami
git init
git remote add origin https://github.com/TansanMilMil/uwabami.git
git fetch origin main
git reset --hard origin/main

# 3. timer を登録する
sudo cp deploy/venus/uwabami-deploy.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now uwabami-deploy.timer
```

## 本番環境の構成

コードからは分からない本番の設定（2026-10-09 時点）。

### サーバー

- さくらのVPS `venus`（`os3-386-26416.vs.sakura.ne.jp`）。SSHユーザーは `alma`
- 本番の環境変数はPJ直下の `.env` ではなく、venus の `~/.env` にまとめてある。SSHログイン時に読み込まれ、`docker compose` はその値を使う。変数を追加・変更するときは venus の `~/.env` を編集する。デプロイの timer は `deploy/venus/pull-deploy.sh` の中で `~/.env` を読み込む
- `UWABAMI_JWT_SECRET_KEY` が未設定だとbackendは起動しない。本番の値は64文字の独自値
- `UWABAMI_GOOGLE_CLIENT_ID` / `UWABAMI_GOOGLE_CLIENT_SECRET` / `UWABAMI_GOOGLE_REDIRECT_URI` / `UWABAMI_GOOGLE_ALLOWED_ACCOUNTS` のどれかが未設定でもbackendは起動しない。`UWABAMI_BASIC_AUTH_USER` / `UWABAMI_BASIC_AUTH_PASS` は使わない
- nginxのログは `logs/nginx/` に出る。secretが一致したCloudFront経由のリクエストは `access.log`、それ以外の直接アクセスは `direct.log`。各行の先頭はリクエストのHost、その次のIPは、secretが一致したときだけ `CloudFront-Viewer-Address` から取った利用者のIP、それ以外は接続元のIP。行末の `rid=` はnginxの `$request_id`（リクエストごとの32桁のID。Slack通知の `request_id` と同じ値）。ローテートは venus の `/etc/logrotate.d/venus-nginx`（`venus-monitoring` で管理）
- 利用者のIPを取るには、CloudFrontのオリジンリクエストポリシーで `CloudFront-Viewer-Address` を転送する必要がある（`AllViewerAndCloudFrontHeaders-2022-06`）。2026-10-09 時点では `AllViewer` で転送していない
- 同じホストで動いているPJ

| PJ | ホストポート |
|---|---|
| wp-kimagure | 80 |
| rudolfs（Git LFS サーバー、develop 外） | 8081 |
| birds_eye_v3 | 8082 |
| nina-njaa | 8090 |
| uwabami | 8093 |

### ネットワーク

- さくらのパケットフィルタで許可しているポート
  - 全体に公開: 80 / 8082 / 8090 / 8093
  - 開発用PC（`14.8.55.225/32`）からのみ: 22 / 8081
- Dockerの `ports` はfirewalldを通らないため、外部からの遮断はパケットフィルタに頼っている。新しくポートを公開するときはパケットフィルタの設定も変える
- venus にグローバルIPv6アドレスはない

### CloudFront

| 項目 | 設定 |
|---|---|
| ディストリビューション | `E323H1OIJ3I616` |
| ドメイン | `uwabami.ts-soda.net` |
| オリジン | venus の 8093 番。CloudFrontとオリジンの間はHTTP（TLSはCloudFrontで終端） |
| カスタムヘッダー | `X-CloudFront-Secret`。値は venus の `UWABAMI_CLOUDFRONT_SECRET` と一致させる |
| キャッシュ | `/api/*` は `CachingDisabled` |
| ViewerProtocolPolicy | `allow-all`（`redirect-to-https` に変更予定） |
| WAF・地域制限・アクセスログ | なし |
