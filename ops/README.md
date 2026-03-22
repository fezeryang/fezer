# Ops Directory - kinetic-portfolio Backend Deployment

Production deployment files for Aliyun VM with Nginx + PM2 + SSL.

## Quick Start

```bash
# 1. Initial server setup (once)
sudo apt update && sudo apt install nginx certbot
npm install -g pm2 pnpm

# 2. Clone repo
git clone <repo-url> /var/www/kinetic-portfolio
cd /var/www/kinetic-portfolio

# 3. Configure environment
cp .env.example .env
nano .env  # Set DATABASE_URL, JWT_SECRET, etc.

# 4. Setup SSL
chmod +x ops/*.sh
./ops/ssl-setup.sh api.your-domain.com admin@your-domain.com

# 5. Configure Nginx
sudo cp ops/nginx-api.conf /etc/nginx/sites-available/kinetic-portfolio-api
sudo ln -s /etc/nginx/sites-available/kinetic-portfolio-api /etc/nginx/sites-enabled/
sudo sed -i 's/api.your-domain.com/YOUR_ACTUAL_DOMAIN/g' /etc/nginx/sites-available/kinetic-portfolio-api
sudo nginx -t && sudo systemctl reload nginx

# 6. Deploy
./ops/deploy.sh

# 7. Enable PM2 startup persistence
pm2 startup  # Follow instructions
pm2 save
```

## Files

| File | Purpose |
|------|---------|
| `ecosystem.config.cjs` | PM2 process configuration |
| `nginx-api.conf` | Nginx HTTPS reverse proxy template |
| `deploy.sh` | Full deployment with rollback safety |
| `ssl-setup.sh` | Let's Encrypt certificate setup |
| `health-check.sh` | Service health verification |

## Health Check

```bash
# Local check (from server)
curl -s 'http://127.0.0.1:3000/api/trpc/system.health?input=%7B%22timestamp%22%3A0%7D'

# External HTTPS check
./ops/health-check.sh https://api.your-domain.com

# Expected response
{"result":{"data":{"ok":true}}}
```

## PM2 Commands

```bash
pm2 status                    # View process status
pm2 logs kinetic-portfolio    # View logs
pm2 reload ecosystem.config.cjs --env production  # Zero-downtime reload
pm2 delete kinetic-portfolio  # Stop and remove
```

## Troubleshooting

**Build fails**: Check Node.js version (20+ required)
**Health check fails**: Check `.env` config, database connectivity
**502 Bad Gateway**: PM2 not running or port mismatch
**SSL errors**: Run `certbot renew --dry-run` to test renewal
