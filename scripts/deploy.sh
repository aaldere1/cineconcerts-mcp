#!/usr/bin/env bash
#
# Deploy cineconcerts-mcp to the cineconcerts.digital droplet.
#
# The remote directory is NOT a git checkout — it holds only the built dist/,
# node_modules/, the manifests and .env. Pushing to GitHub deploys nothing, so
# this script is the deploy path.
#
# It builds, backs up what is currently live, ships the build, restarts pm2 by
# name, and health-checks. If the health check fails it rolls back to the
# backup automatically and exits non-zero.
#
# Usage:
#   ./scripts/deploy.sh              # build, deploy, verify
#   ./scripts/deploy.sh --dry-run    # show what would change, touch nothing
#   ./scripts/deploy.sh --no-build   # deploy the existing dist/ as-is
#
set -euo pipefail

# Target details live in scripts/deploy.env (gitignored) rather than in this
# public repo. Copy scripts/deploy.env.example to get started, or export the
# same DEPLOY_* variables in your shell.
ENV_FILE="$(dirname "$0")/deploy.env"
# shellcheck source=/dev/null
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

HOST="${DEPLOY_HOST:-}"
REMOTE_DIR="${DEPLOY_DIR:-}"
PM2_APP="${DEPLOY_PM2_APP:-cc-mcp}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1:8421/health}"
KEEP_BACKUPS="${DEPLOY_KEEP_BACKUPS:-3}"

if [ -z "$HOST" ] || [ -z "$REMOTE_DIR" ]; then
  cat >&2 <<'ERR'
DEPLOY_HOST and DEPLOY_DIR are not set.

Create scripts/deploy.env (it is gitignored):

    cp scripts/deploy.env.example scripts/deploy.env
    $EDITOR scripts/deploy.env

or export DEPLOY_HOST / DEPLOY_DIR in your shell.
ERR
  exit 2
fi

DRY_RUN=false
DO_BUILD=true
for arg in "$@"; do
  case "$arg" in
    --dry-run)  DRY_RUN=true ;;
    --no-build) DO_BUILD=false ;;
    -h|--help)  sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."
say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ssh_do() { ssh -o ConnectTimeout=20 "$HOST" "$@"; }

# --- 1. Build ---------------------------------------------------------------
if $DO_BUILD; then
  say "Building"
  rm -rf dist
  npx tsc
fi

# The server will not boot without these, so fail here rather than on the box.
for f in dist/index.js dist/ui/showsWidget.js dist/tools/renderWidget.js; do
  [ -f "$f" ] || { echo "missing build output: $f" >&2; exit 1; }
done
echo "build output OK ($(find dist -name '*.js' | wc -l | tr -d ' ') js files)"

# --- 2. Preflight -----------------------------------------------------------
say "Preflight"
ssh_do "test -d '$REMOTE_DIR'" || { echo "remote dir $REMOTE_DIR missing" >&2; exit 1; }
ssh_do "pm2 describe '$PM2_APP' >/dev/null 2>&1" \
  || { echo "pm2 app '$PM2_APP' not found — refusing to deploy blind" >&2; exit 1; }
echo "remote dir and pm2 app '$PM2_APP' present"

if $DRY_RUN; then
  say "Dry run — changes that WOULD be shipped"
  rsync -ain --no-owner --no-group --delete dist/ "$HOST:$REMOTE_DIR/dist/"
  rsync -ain --no-owner --no-group package.json package-lock.json ecosystem.config.cjs "$HOST:$REMOTE_DIR/"
  echo
  echo "(nothing was changed)"
  exit 0
fi

# --- 3. Back up what is live ------------------------------------------------
say "Backing up current dist"
BACKUP="dist.backup-$(date +%Y%m%d-%H%M%S)"
ssh_do "cd '$REMOTE_DIR' && cp -r dist '$BACKUP' && echo '  $BACKUP'"

# --- 4. Ship ----------------------------------------------------------------
say "Shipping build"
# --delete so files removed from the build also disappear on the server.
rsync -a --no-owner --no-group --delete dist/ "$HOST:$REMOTE_DIR/dist/"
# Keep the remote manifest truthful: node_modules there was once out of sync
# with package.json, which would have broken the next npm ci.
rsync -a --no-owner --no-group package.json package-lock.json ecosystem.config.cjs "$HOST:$REMOTE_DIR/"
echo "dist + manifests synced"

# --- 5. Restart (by name — numeric pm2 ids drift on this shared box) --------
say "Restarting $PM2_APP"
ssh_do "pm2 restart '$PM2_APP' --update-env >/dev/null && sleep 3 && pm2 describe '$PM2_APP' | grep -E 'status|uptime'"

# --- 6. Verify, roll back if unhealthy --------------------------------------
say "Health check"
# /health is deliberately not exposed publicly (nginx only routes /mcp/),
# so check it from inside the box.
if ssh_do "curl -fsS --max-time 10 '$HEALTH_URL'" | jq -e '.status == "ok"' >/dev/null 2>&1; then
  ssh_do "curl -fsS --max-time 10 '$HEALTH_URL'" | jq -c '{status, version, tools: (.tools | length)}'
  echo "healthy"
else
  echo "HEALTH CHECK FAILED — rolling back to $BACKUP" >&2
  ssh_do "cd '$REMOTE_DIR' && rm -rf dist && mv '$BACKUP' dist && pm2 restart '$PM2_APP' --update-env >/dev/null && sleep 3"
  ssh_do "curl -fsS --max-time 10 '$HEALTH_URL'" >/dev/null 2>&1 \
    && echo "rolled back and healthy again" >&2 \
    || echo "ROLLBACK ALSO UNHEALTHY — needs a human" >&2
  exit 1
fi

# --- 7. Prune old backups ---------------------------------------------------
say "Pruning backups (keeping $KEEP_BACKUPS)"
ssh_do "cd '$REMOTE_DIR' && ls -1dt dist.backup-* 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -rf; ls -1dt dist.backup-* 2>/dev/null | sed 's/^/  /' || true"

say "Deployed"
