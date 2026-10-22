#!/bin/bash
# Claude Code on the web: get the repo ready before the session starts.
# - npm dependencies (flows, type-check, build)
# - rtk (github.com/rtk-ai/rtk, Apache-2.0): trims command output before it
#   reaches the context. Release downloads are blocked by the cloud proxy, so
#   it is built from source once; the container snapshot keeps it afterwards.
#   Bash commands are rewritten by .claude/hooks/rtk-rewrite.sh (PreToolUse).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

npm install --no-audit --no-fund --loglevel=error

# Firebase CLI: the flow tests (npm run test:flows) start the emulators with it.
command -v firebase >/dev/null 2>&1 || npm install -g firebase-tools@14 --loglevel=error

RTK_REV=f16becacd2f40616839333b3e0e281e40a0bc823   # rtk 0.49.0
export PATH="$HOME/.cargo/bin:$PATH"
if ! command -v rtk >/dev/null 2>&1 || ! rtk gain >/dev/null 2>&1; then
  cargo install --git https://github.com/rtk-ai/rtk --rev "$RTK_REV" --locked --quiet
fi
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
fi
rtk --version
