# Operational Runbook: kinetic-portfolio

This document provides guidance for observability, backup, and rollback procedures for the kinetic-portfolio backend.

## 1. Observability

### Log Locations
- **PM2 Logs**: `/home/fezer/.pm2/logs/` (or wherever PM2 is configured to store logs)
- **Application Logs**: `/var/log/kinetic-portfolio/` (as defined in `deploy.sh`)
- **Nginx Logs**: `/var/log/nginx/kinetic-portfolio-api.access.log` and `error.log`

### Monitoring Commands
```bash
# View real-time PM2 logs
pm2 logs kinetic-portfolio

# Check process status and resource usage
pm2 status
pm2 monit

# Check Nginx status
sudo systemctl status nginx

# Check disk space
df -h
```

### Health Endpoints
- **Internal**: `http://localhost:3000/api/trpc/system.health?input=%7B%22timestamp%22%3A0%7D`
- **External**: `https://api.your-domain.com/health` (mapped via Nginx)

### Triage Checklist
1. **Service Down (502 Bad Gateway)**:
   - Check if PM2 process is running: `pm2 status`
   - Check PM2 logs for crashes: `pm2 logs kinetic-portfolio --lines 100`
   - Check if port 3000 is bound: `sudo netstat -tulpn | grep 3000`
2. **Database Errors**:
   - Check `DATABASE_URL` in `.env`
   - Verify database connectivity: `mysql -h <host> -u <user> -p`
3. **Slow Performance**:
   - Check `pm2 monit` for CPU/Memory spikes
   - Check Nginx access logs for high latency requests

---

## 2. Backup & Restore

### Backup Strategy
- **Database**: Daily logical dumps using `mysqldump`.
- **Files**: `.env` and any uploaded assets (if not using S3).

### Manual Backup
```bash
# Run the backup script
./ops/backup.sh
```

### Restore Procedure
1. **Stop the service**: `pm2 stop kinetic-portfolio`
2. **Restore database**:
   ```bash
   gunzip < backups/db_backup_YYYYMMDD_HHMMSS.sql.gz | mysql -h <host> -u <user> -p <db_name>
   ```
3. **Verify restoration**:
   ```bash
   # Run a count query on a key table
   mysql -h <host> -u <user> -p <db_name> -e "SELECT COUNT(*) FROM users;"
   ```
4. **Start the service**: `pm2 start kinetic-portfolio`

### Backup Integrity Check
- Periodically (e.g., monthly) perform a restore drill on a staging/local environment to ensure backups are valid.

---

## 3. Rollback

### Trigger Conditions
- Health check fails after deployment.
- Critical bug discovered in production that cannot be fixed quickly ("hotfix").
- Significant performance regression.

### Rollback Procedure
The `deploy.sh` script automatically creates a rollback point. To manually roll back to a specific commit:

```bash
# 1. Identify the stable commit hash
git log --oneline -n 10

# 2. Run the rollback command (using the helper script)
./ops/rollback.sh <commit-hash>
```

### Post-Rollback Validation
1. Run health check: `./ops/health-check.sh`
2. Verify critical user flows (Login, Content Publishing).
3. Check logs for any residual errors.

### Communication Checklist
- Notify stakeholders of the incident and the rollback.
- Document the root cause in `issues.md`.
- Update the status page (if applicable).
