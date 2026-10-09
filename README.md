# uwabami

呑んだお酒・呑みたいお酒を記録するWebアプリ。React + FastAPI + SQLite を Docker Compose（nginx / backend）で動かす。設計の経緯は [drink_app_plan.md](./drink_app_plan.md) を参照。

## 開発

```bash
task install
task dev
```

Vite dev server と uvicorn（`:8001`）が起動する。ブラウザでのE2E確認に関する注意は [CLAUDE.md](./CLAUDE.md) を参照。

## デプロイ

```bash
task deploy
```

venus の `~/uwabami` に rsync し、`docker compose build` してから起動し直す。`.env` と `db/*.db` は転送しない。本番DBをローカルに複製するときは `task db:pull` を使う。

## 本番環境の構成

コードからは分からない本番の設定（2026-10-09 時点）。

### サーバー

- さくらのVPS `venus`（`os3-386-26416.vs.sakura.ne.jp`）。SSHユーザーは `alma`
- 本番の環境変数はPJ直下の `.env` ではなく、venus の `~/.env` にまとめてある。SSHログイン時に読み込まれ、`docker compose` はその値を使う。変数を追加・変更するときは venus の `~/.env` を編集する
- `UWABAMI_JWT_SECRET_KEY` が未設定だとbackendは起動しない。本番の値は64文字の独自値
- ユーザー登録APIはない。本番のユーザーは、`UWABAMI_BASIC_AUTH_USER` / `UWABAMI_BASIC_AUTH_PASS` から起動時に作られる `admin` だけ
- nginxのログは `logs/nginx/` に出る。secretが一致したCloudFront経由のリクエストは `access.log`、それ以外の直接アクセスは `direct.log`。各行の先頭はリクエストのHost、その次のIPは、secretが一致したときだけ `CloudFront-Viewer-Address` から取った利用者のIP、それ以外は接続元のIP。行末の `rid=` はnginxの `$request_id`（リクエストごとの32桁のID。Slack通知の `request_id` と同じ値）。ローテートは venus の `/etc/logrotate.d/venus-nginx`（`venus-monitoring` で管理）
- 遮断リスト（JPCERTのIoCなど）は、venus の `~/.env` の `VENUS_NGINX_BLOCKLIST_DIR`（`/home/alma/venus-monitoring/nginx-blocklist`）を `/etc/nginx/blocklist` にマウントして読む。未設定だとリポジトリ内の空のリストが使われ、何も遮断しない
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
