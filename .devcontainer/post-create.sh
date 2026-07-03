#!/bin/bash
set -e

# Tools
sudo apt-get update -qq && sudo apt-get install -y -qq rsync sqlite3 curl

# Claude Code CLI
curl -fsSL https://claude.ai/install.sh | bash

# Antigravity CLI
curl -fsSL https://antigravity.google/cli/install.sh | bash

# Task CLI
sudo sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b /usr/local/bin

# SSH known hosts
mkdir -p ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts || true

# Frontend
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
  cd frontend
  npm install
  cd ..
fi

# Backend
if [ -d "backend" ] && [ -f "backend/requirements.txt" ]; then
  cd backend
  python3 -m venv --clear .venv
  .venv/bin/pip install -r requirements.txt
  cd ..
fi

echo "Post-create setup complete!"
