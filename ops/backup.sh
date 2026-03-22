#!/bin/bash
# ops/backup.sh - Database backup script for kinetic-portfolio
#
# This script creates a compressed MySQL dump of the database.
# It expects DATABASE_URL to be set in the environment or .env file.

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[BACKUP]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Load .env if it exists
if [ -f .env ]; then
  log "Loading environment from .env"
  # Use a more robust way to load .env
  set -a
  source .env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  error "DATABASE_URL is not set"
  exit 1
fi

# Parse DATABASE_URL (mysql://user:pass@host:port/db)
# Using python for robust parsing if available, otherwise fallback to sed
if command -v python3 >/dev/null 2>&1; then
  DB_PARSED=$(python3 -c "
import urllib.parse as p
import sys
try:
    u = p.urlparse('$DATABASE_URL')
    print(f'{u.username} {u.password} {u.hostname} {u.port or 3306} {u.path.lstrip(\"/\")}')
except:
    sys.exit(1)
")
  read -r DB_USER DB_PASS DB_HOST DB_PORT DB_NAME <<< "$DB_PARSED"
else
  # Fallback to sed (less robust but works for standard formats)
  DB_USER=$(echo $DATABASE_URL | sed -e 's/mysql:\/\/\([^:]*\):.*/\1/')
  DB_PASS=$(echo $DATABASE_URL | sed -e 's/mysql:\/\/.*:\([^@]*\)@.*/\1/')
  DB_HOST=$(echo $DATABASE_URL | sed -e 's/mysql:\/\/.*@\([^:]*\):.*/\1/')
  DB_PORT=$(echo $DATABASE_URL | sed -e 's/mysql:\/\/.*:\([^\/]*\)\/.*/\1/' | grep -o '[0-9]*' || echo "3306")
  DB_NAME=$(echo $DATABASE_URL | sed -e 's/mysql:\/\/.*\/\([^?]*\).*/\1/')
fi

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

log "Backing up database '$DB_NAME' from $DB_HOST:$DB_PORT..."

# Check if mysqldump is available
if ! command -v mysqldump >/dev/null 2>&1; then
  error "mysqldump not found. Please install mysql-client."
  exit 1
fi

# Perform backup
if mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" --no-tablespaces "$DB_NAME" | gzip > "$BACKUP_FILE"; then
  log "Backup completed: $BACKUP_FILE"
  # Keep only last 7 days of backups
  find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +7 -delete
  log "Cleaned up backups older than 7 days"
else
  error "Backup failed"
  exit 1
fi
