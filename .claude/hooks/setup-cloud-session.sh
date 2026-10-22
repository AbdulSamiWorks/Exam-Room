#!/usr/bin/env bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

git config user.name "sami"
git config user.email "abdulsami34421@gmail.com"

if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund >&2
fi

if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "Cloud session ready: Node $(node --version), dependencies installed, .env ready."
