#!/bin/bash
# ops/rollback.sh - Rollback script for kinetic-portfolio
#
# Usage: ./ops/rollback.sh <commit-hash>

set -euo pipefail

APP_DIR="/var/www/fezer"
PM2_APP_NAME="fezer-api"
PM2_CONFIG="ops/ecosystem.config.cjs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[ROLLBACK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

if [ $# -eq 0 ]; then
    error "Usage: $0 <commit-hash>"
    exit 1
fi

COMMIT=$1

log "Starting rollback to $COMMIT..."

# Check if we are in the right directory
if [ ! -d "$APP_DIR" ]; then
    warn "APP_DIR $APP_DIR not found, using current directory"
    APP_DIR=$(pwd)
fi

cd "$APP_DIR"

# Verify commit exists
if ! git rev-parse --verify "$COMMIT" >/dev/null 2>&1; then
    error "Commit $COMMIT not found"
    exit 1
fi

log "Checking out $COMMIT..."
git checkout "$COMMIT"

log "Installing dependencies..."
pnpm install --frozen-lockfile

log "Building application..."
pnpm run build

log "Reloading PM2 service..."
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    pm2 reload "$PM2_APP_NAME" --update-env
else
    pm2 start "$PM2_CONFIG" --env production
fi

log "Verifying health..."
# Try local health check first
HEALTH_URL="http://127.0.0.1:3000/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D"
if curl -sf "$HEALTH_URL" | grep -q '"ok":true'; then
    log "Rollback successful!"
else
    error "Rollback failed health check. Please investigate logs."
    pm2 logs "$PM2_APP_NAME" --lines 20 --nostream
    exit 1
fi
