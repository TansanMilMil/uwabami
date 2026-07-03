#!/bin/bash
set -euo pipefail

# デプロイ先サーバーとディレクトリの設定
TARGET_HOST="venus"
TARGET_DIR="~/uwabami"

echo "🚀 Deploying to ${TARGET_HOST}:${TARGET_DIR} ..."

# プロジェクトルートディレクトリに移動
cd "$(dirname "$0")/.."

# ターゲットサーバーにディレクトリが存在しない場合は作成する
ssh "${TARGET_HOST}" "mkdir -p ${TARGET_DIR}"

# rsyncでプロジェクトファイルを転送
# --delete: ローカルにないファイルをサーバーからも削除する
rsync -avz --delete \
    --exclude='.git/' \
    --exclude='.venv/' \
    --exclude='node_modules/' \
    --exclude='__pycache__/' \
    --exclude='.devcontainer/' \
    --exclude='backend/db/*.db' \
    --exclude='frontend/dist/' \
    --exclude='backups/' \
    --exclude='.env' \
    ./ "${TARGET_HOST}:${TARGET_DIR}/"

# SSHでサーバーに入り、Docker Composeを再起動する
echo "🔄 Restarting Docker containers on ${TARGET_HOST} ..."
ssh "${TARGET_HOST}" "cd ${TARGET_DIR} && docker compose down && docker compose build && docker compose up -d"

echo "✅ Deployment completed successfully!"
