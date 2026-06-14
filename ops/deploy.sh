#!/bin/bash
#
# kinetic-portfolio deployment script
# 
# Usage:
#   ./deploy.sh              # Full deploy
#   ./deploy.sh --skip-deps  # Skip npm install (faster redeploy)
#
# Prerequisites:
#   - Node.js 20+, pnpm, PM2 installed
#   - MySQL/MariaDB accessible via DATABASE_URL
#   - .env file configured in /var/www/fezer/.env
#
set -euo pipefail

# Configuration
APP_DIR="/var/www/fezer"
LOG_DIR="/var/log/kinetic-portfolio"
REPO_URL="${REPO_URL:-git@github.com:your-org/kinetic-portfolio.git}"
BRANCH="${BRANCH:-main}"
PM2_APP_NAME="fezer-api"
PM2_CONFIG="ops/ecosystem.config.cjs"
HEALTH_URL="http://127.0.0.1:3000/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D"
HEALTH_TIMEOUT=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
die() { error "$1"; exit 1; }

# Parse arguments
SKIP_DEPS=false
for arg in "$@"; do
    case $arg in
        --skip-deps) SKIP_DEPS=true ;;
    esac
done

#------------------------------------------------------------------------------
# Pre-deploy checks
#------------------------------------------------------------------------------
check_prerequisites() {
    log "Checking prerequisites..."
    
    command -v node >/dev/null 2>&1 || die "Node.js is not installed"
    command -v pnpm >/dev/null 2>&1 || die "pnpm is not installed"
    command -v pm2 >/dev/null 2>&1 || die "PM2 is not installed"
    
    # Verify Node version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    [ "$NODE_VERSION" -ge 20 ] || die "Node.js 20+ required, got v$NODE_VERSION"
    
    # Ensure directories exist
    sudo mkdir -p "$LOG_DIR"
    sudo chown -R "$(whoami):$(whoami)" "$LOG_DIR"
    
    # Verify .env exists
    [ -f "$APP_DIR/.env" ] || warn ".env file not found - ensure environment variables are set"
    
    log "Prerequisites OK"
}

#------------------------------------------------------------------------------
# Git operations
#------------------------------------------------------------------------------
update_code() {
    log "Updating code from $BRANCH..."
    cd "$APP_DIR"
    
    # Stash any local changes
    git stash --quiet 2>/dev/null || true
    
    # Fetch and checkout
    git fetch origin "$BRANCH"
    git checkout "$BRANCH"
    git reset --hard "origin/$BRANCH"
    
    COMMIT=$(git rev-parse --short HEAD)
    log "Code updated to commit: $COMMIT"
}

#------------------------------------------------------------------------------
# Build process
#------------------------------------------------------------------------------
install_deps() {
    if [ "$SKIP_DEPS" = true ]; then
        log "Skipping dependency installation (--skip-deps)"
        return
    fi
    
    log "Installing dependencies..."
    cd "$APP_DIR"
    pnpm install --frozen-lockfile
}

build_app() {
    log "Building application..."
    cd "$APP_DIR"
    
    # Clean previous build
    rm -rf dist/
    
    # Build frontend and backend
    pnpm run build
    
    # Verify build output
    [ -f "dist/index.js" ] || die "Build failed: dist/index.js not found"
    
    log "Build completed successfully"
}

#------------------------------------------------------------------------------
# Database migration
#------------------------------------------------------------------------------
run_migrations() {
    log "Running database migrations..."
    cd "$APP_DIR"
    
    # Generate and apply migrations using drizzle-kit
    pnpm run db:push
    
    log "Migrations completed"
}

#------------------------------------------------------------------------------
# Service management
#------------------------------------------------------------------------------
reload_service() {
    log "Reloading PM2 service..."
    cd "$APP_DIR"
    
    # Check if app is already running
    if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
        # Graceful reload (zero-downtime)
        pm2 reload "$PM2_APP_NAME" --update-env
    else
        # First deploy - start fresh
        pm2 start "$PM2_CONFIG" --env production
    fi
    
    # Save PM2 process list for startup persistence
    pm2 save
    
    log "Service reloaded"
}

#------------------------------------------------------------------------------
# Health check
#------------------------------------------------------------------------------
verify_health() {
    log "Verifying service health (timeout: ${HEALTH_TIMEOUT}s)..."
    
    local start_time=$(date +%s)
    local end_time=$((start_time + HEALTH_TIMEOUT))
    
    while [ $(date +%s) -lt $end_time ]; do
        # Query tRPC health endpoint
        if curl -sf "$HEALTH_URL" | grep -q '"ok":true'; then
            log "Health check passed!"
            return 0
        fi
        sleep 2
    done
    
    error "Health check failed after ${HEALTH_TIMEOUT}s"
    log "Recent PM2 logs:"
    pm2 logs "$PM2_APP_NAME" --lines 20 --nostream
    return 1
}

#------------------------------------------------------------------------------
# Rollback support
#------------------------------------------------------------------------------
create_rollback_point() {
    ROLLBACK_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
    if [ -n "$ROLLBACK_COMMIT" ]; then
        log "Rollback point: $ROLLBACK_COMMIT"
    fi
}

rollback() {
    if [ -n "${ROLLBACK_COMMIT:-}" ]; then
        warn "Rolling back to $ROLLBACK_COMMIT..."
        cd "$APP_DIR"
        git checkout "$ROLLBACK_COMMIT"
        pnpm run build
        pm2 reload "$PM2_APP_NAME" --update-env
        warn "Rollback completed - please investigate the failure"
    else
        error "No rollback point available"
    fi
}

#------------------------------------------------------------------------------
# Main deploy flow
#------------------------------------------------------------------------------
main() {
    log "Starting deployment..."
    log "Target: $APP_DIR"
    log "Branch: $BRANCH"
    
    check_prerequisites
    
    cd "$APP_DIR"
    create_rollback_point
    
    update_code
    install_deps
    
    # Build before stopping service (rollback-safe)
    build_app
    
    # Run migrations AFTER successful build
    run_migrations
    
    # Reload service with new build
    reload_service
    
    # Verify deployment
    if ! verify_health; then
        warn "Deployment may have failed - attempting rollback"
        rollback
        exit 1
    fi
    
    log "=========================================="
    log "Deployment completed successfully!"
    log "Commit: $(git rev-parse --short HEAD)"
    log "=========================================="
}

# Run
main
