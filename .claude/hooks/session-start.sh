#!/bin/bash
# Installs dependencies in Claude Code cloud sessions so lint, typecheck, tests and Playwright work.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# pnpm install (not --frozen-lockfile) so the cached container state is reused and stays idempotent.
corepack enable >/dev/null 2>&1 || true
pnpm install --prefer-offline

# Use the pre-installed Chromium instead of downloading browsers.
if [ -x /opt/pw-browsers/chromium ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PW_CHROMIUM_PATH=/opt/pw-browsers/chromium' >> "$CLAUDE_ENV_FILE"
  echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1' >> "$CLAUDE_ENV_FILE"
fi
