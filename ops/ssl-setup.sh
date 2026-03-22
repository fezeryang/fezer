#!/bin/bash
#
# SSL Certificate Setup for kinetic-portfolio API
# Uses Let's Encrypt certbot with webroot authentication
#
set -euo pipefail

DOMAIN="${1:-api.your-domain.com}"
EMAIL="${2:-admin@your-domain.com}"
WEBROOT="/var/www/certbot"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log() { echo -e "${GREEN}[SSL]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }

command -v certbot >/dev/null 2>&1 || error "certbot not installed. Run: apt install certbot"

log "Setting up SSL for: $DOMAIN"
log "Email: $EMAIL"

mkdir -p "$WEBROOT/.well-known/acme-challenge"

sudo certbot certonly \
    --webroot \
    --webroot-path "$WEBROOT" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --domain "$DOMAIN" \
    --non-interactive

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log "Certificate installed successfully!"
    log "Certificate path: /etc/letsencrypt/live/$DOMAIN/"
    log "Reload nginx: systemctl reload nginx"
else
    error "Certificate installation failed"
fi

log "Auto-renewal test:"
sudo certbot renew --dry-run

cat << 'EOF'

Renewal is handled automatically via systemd timer.
Verify with: systemctl list-timers | grep certbot

Manual renewal: certbot renew --quiet
Force renewal:  certbot renew --force-renewal

EOF
