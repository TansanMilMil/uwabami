#!/bin/bash
set -euo pipefail

# デプロイ先サーバーとディレクトリの設定 (deploy.sh と合わせる)
TARGET_HOST="venus"
TARGET_DIR="~/uwabami"

# プロジェクトルートディレクトリに移動
cd "$(dirname "$0")/.."

LOCAL_DB="db/drinks.db"
REMOTE_DB="${TARGET_DIR}/db/drinks.db"

mkdir -p db

# ローカルに既存の drinks.db があればバックアップを残す
if [ -f "${LOCAL_DB}" ]; then
    mkdir -p backups
    dest="backups/drinks_local_$(date +%Y%m%d_%H%M%S).db"
    cp "${LOCAL_DB}" "$dest"
    echo "📦 ローカルの既存DBをバックアップ: ${dest}"
fi

echo "⬇️  Fetching ${TARGET_HOST}:${REMOTE_DB} ..."
scp "${TARGET_HOST}:${REMOTE_DB}" "${LOCAL_DB}"

echo "✅ 本番の drinks.db をローカルに複製しました: ${LOCAL_DB}"
