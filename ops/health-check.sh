#!/bin/bash
set -euo pipefail

API_URL="${1:-https://api.your-domain.com}"
HEALTH_ENDPOINT="${API_URL}/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

RESPONSE=$(curl -sf -w "\n%{http_code}" "$HEALTH_ENDPOINT" 2>/dev/null || echo -e "\n000")
BODY=$(echo "$RESPONSE" | head -n1)
STATUS=$(echo "$RESPONSE" | tail -n1)

if [ "$STATUS" = "200" ] && echo "$BODY" | grep -q '"ok":true'; then
    echo -e "${GREEN}✓${NC} Health check passed"
    echo "  Endpoint: $HEALTH_ENDPOINT"
    echo "  Response: $BODY"
    exit 0
else
    echo -e "${RED}✗${NC} Health check failed"
    echo "  Endpoint: $HEALTH_ENDPOINT"
    echo "  Status: $STATUS"
    echo "  Body: $BODY"
    exit 1
fi
