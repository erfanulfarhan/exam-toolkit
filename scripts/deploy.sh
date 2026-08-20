#!/usr/bin/env bash
# Deploy, then point the short domain at what was just deployed.
#
# A *.vercel.app alias sticks to the deployment it was set on, so without this
# second step examkit.vercel.app quietly serves an older build while the long
# project URL moves ahead.
set -euo pipefail
cd "$(dirname "$0")/.."

URL=$(npx vercel --prod --yes 2>&1 | grep -Eo 'https://examkit-[a-z0-9]+-c-e113\.vercel\.app' | tail -1)
[ -n "$URL" ] || { echo "could not read the deployment URL"; exit 1; }

npx vercel alias set "$URL" examkit.vercel.app
npx vercel alias set "$URL" edexcel-grade-calc.vercel.app || true   # keep old links alive

printf '\nlive: https://examkit.vercel.app\n'
