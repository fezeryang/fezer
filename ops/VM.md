# Production VM Inventory

This file records the observed production VM and API runtime for this project. It is intentionally operational metadata only. Do not add private keys, `.env` values, database credentials, API keys, or certificate private material here.

## Host

| Item | Value |
| --- | --- |
| Public IP | `4.188.113.194` |
| API domain | `https://api.fezern8n.com` |
| SSH aliases seen locally | `my-azure-vm`, `openclawed` |
| Runtime SSH user | `openclawed` |
| App directory | `/var/www/fezer` |
| Node entrypoint | `/var/www/fezer/dist/index.js` |
| PM2 process | `fezer-api` |
| App port | `3000` |
| Frontend hosting | GitHub Pages |
| Frontend API target | `https://api.fezern8n.com` |

## SSH Notes

The local workstation has SSH config entries for the VM. Use the configured aliases where available:

```bash
ssh openclawed
ssh my-azure-vm
```

If using an explicit key, reference the key from the local SSH config or password manager. Never copy the private key into this repository.

## Important Paths

| Path | Purpose |
| --- | --- |
| `/var/www/fezer` | Production repo checkout |
| `/var/www/fezer/.env` | Production environment variables, not committed |
| `/var/www/fezer/dist/index.js` | Built backend entrypoint served by PM2 |
| `/home/openclawed/.pm2/logs/` | PM2 logs |
| `/var/log/nginx/` | Nginx access and error logs |

## Runtime Commands

Run these on the VM as `openclawed`.

```bash
cd /var/www/fezer
git rev-parse --short HEAD
pm2 list
pm2 logs fezer-api --lines 100
pm2 reload fezer-api --update-env
pm2 save
```

If `pm2` is not on the default SSH path, load the user npm global bin first:

```bash
export PATH="$HOME/.npm-global/bin:$PATH"
```

## Health Checks

Internal VM check:

```bash
curl -s 'http://127.0.0.1:3000/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D'
```

External public check:

```bash
curl -s 'https://api.fezern8n.com/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D'
```

Expected response:

```json
{"result":{"data":{"json":{"ok":true}}}}
```

## Deploy Checklist

Use `ops/deploy.sh` for normal deploys when possible. The manual equivalent is:

```bash
export PATH="$HOME/.npm-global/bin:$PATH"
cd /var/www/fezer
git pull --ff-only origin main
pnpm run build
pm2 reload fezer-api --update-env
pm2 save
```

After deploy, verify:

```bash
git rev-parse --short HEAD
pm2 list
curl -s 'https://api.fezern8n.com/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D'
```

## Current Jianli Grounding Incident Note

On 2026-06-14, the GitHub Pages frontend had been updated but the production API VM was still on an older backend commit. The live `/jianli` agents therefore ignored the new `grounding: "public_profile"` request field and answered with stale placeholder data.

Fix applied:

- Production repo: `/var/www/fezer`
- Actual PM2 process: `fezer-api`
- Backend updated past `25c7cc3`, which added public profile grounding.
- Production repo then fast-forwarded to `b0a6ef7`, which aligned ops docs/scripts with the real VM.

Verification prompt sent to the production API:

```bash
curl -sS --max-time 60 https://api.fezern8n.com/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"userInput":"请严格根据真实简历介绍 Fezer 的教育背景和邮箱，不要编造。","roomId":"central","interactionType":"chat","grounding":"public_profile"}'
```

Expected facts in the answer:

- `中央财经大学保险专业硕士`
- `cookfezer@gmail.com`
