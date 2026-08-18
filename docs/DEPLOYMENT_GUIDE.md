# Raven Oracle - Production Deployment Guide

**Version:** 1.0  
**Last Updated:** August 19, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Server Requirements](#server-requirements)
4. [Step 1: Server Setup](#step-1-server-setup)
5. [Step 2: Install Dependencies](#step-2-install-dependencies)
6. [Step 3: PostgreSQL Setup](#step-3-postgresql-setup)
7. [Step 4: Repository Setup](#step-4-repository-setup)
8. [Step 5: Environment Configuration](#step-5-environment-configuration)
9. [Step 6: Database Migration](#step-6-database-migration)
10. [Step 7: Build Applications](#step-7-build-applications)
11. [Step 8: PM2 Process Management](#step-8-pm2-process-management)
12. [Step 9: Nginx Configuration](#step-9-nginx-configuration)
13. [Step 10: SSL/HTTPS Setup](#step-10-ssl-https-setup)
14. [Step 11: Backup Configuration](#step-11-backup-configuration)
15. [Step 12: Monitoring Setup](#step-12-monitoring-setup)
16. [Step 13: Deployment Verification](#step-13-deployment-verification)
17. [Maintenance Procedures](#maintenance-procedures)
18. [Troubleshooting](#troubleshooting)
19. [Security Checklist](#security-checklist)

---

## Overview

This guide covers deploying Raven Oracle to a production environment using:

- **Frontend:** Next.js (port 3000)
- **Backend:** Express API (port 4000)
- **Database:** PostgreSQL
- **Web Server:** Nginx (reverse proxy)
- **Process Manager:** PM2
- **SSL:** Let's Encrypt (Certbot)

### Architecture

```
Internet
   |
HTTPS (443)
   |
Nginx Reverse Proxy
   |
   +----> Next.js Web (localhost:3000)
   |
   +----> Express API (localhost:4000)
              |
         PostgreSQL (localhost:5432)
```

---

## Prerequisites

### Required Accounts
- [x] Domain name registered
- [x] DNS configured to point to server
- [x] GitHub repository access
- [x] Discord OAuth app created (optional)
- [x] X OAuth app created (optional)
- [x] Gmail account for SMTP (optional)

### Required Information
- Server IP address
- Domain name (e.g., ravenoracle.com)
- SSH access to server
- Root or sudo privileges

---

## Server Requirements

### Minimum Specifications
- **OS:** Ubuntu 20.04+ or Debian 11+
- **RAM:** 2GB minimum, 4GB recommended
- **CPU:** 2 cores minimum
- **Storage:** 20GB minimum, 40GB recommended
- **Network:** Static IP address

### Recommended VPS Providers (Free Tier Available)
- Oracle Cloud (Always Free tier)
- Google Cloud Platform (Free trial)
- AWS (Free tier)
- DigitalOcean ($200 credit)
- Linode
- Vultr

---

## Step 1: Server Setup

### 1.1 Initial Server Access

```bash
# SSH into server
ssh root@your-server-ip

# Update system packages
apt update && apt upgrade -y

# Set timezone
timedatectl set-timezone UTC
```

### 1.2 Create Deployment User

```bash
# Create user
adduser raven

# Add to sudo group
usermod -aG sudo raven

# Switch to new user
su - raven
```

### 1.3 Configure Firewall

```bash
# Enable UFW
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## Step 2: Install Dependencies

### 2.1 Install Node.js

```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### 2.2 Install PostgreSQL

```bash
# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Verify installation
sudo systemctl status postgresql
```

### 2.3 Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2.4 Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### 2.5 Install Git

```bash
# Install Git
sudo apt install -y git

# Verify installation
git --version
```

### 2.6 Install Certbot (SSL)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx
```

---

## Step 3: PostgreSQL Setup

### 3.1 Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# Run these commands in PostgreSQL prompt:
```

```sql
-- Create database
CREATE DATABASE raven_oracle;

-- Create user with password
CREATE USER raven_user WITH ENCRYPTED PASSWORD 'CHANGE_THIS_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE raven_oracle TO raven_user;

-- Grant schema privileges
\c raven_oracle
GRANT ALL ON SCHEMA public TO raven_user;

-- Exit PostgreSQL
\q
```

### 3.2 Configure PostgreSQL

```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/15/main/postgresql.conf
```

Update these settings:

```conf
# Listen on localhost only
listen_addresses = 'localhost'

# Increase max connections
max_connections = 100

# Set shared buffers (25% of RAM)
shared_buffers = 512MB  # Adjust based on RAM

# Set effective cache size (50% of RAM)
effective_cache_size = 1GB  # Adjust based on RAM
```

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 3.3 Test Database Connection

```bash
# Test connection
psql -h localhost -U raven_user -d raven_oracle

# Should prompt for password, then connect
# Type \q to exit
```

---

## Step 4: Repository Setup

### 4.1 Clone Repository

```bash
# Navigate to home directory
cd /home/raven

# Clone repository
git clone https://github.com/labraven3/raven-oracle.git

# Navigate to project
cd raven-oracle

# Verify branch
git branch
```

### 4.2 Install Dependencies

```bash
# Install root dependencies
npm install

# Install API dependencies
cd apps/api
npm install
cd ../..

# Install Web dependencies
cd apps/web
npm install
cd ../..
```

### 4.3 Generate Prisma Client

```bash
# Generate Prisma client
npx prisma generate
```

---

## Step 5: Environment Configuration

### 5.1 Create API Environment File

```bash
# Navigate to API directory
cd /home/raven/raven-oracle/apps/api

# Create .env file
nano .env
```

Add the following (replace values):

```env
# Node Environment
NODE_ENV=production

# Server Configuration
PORT=4000
WEB_ORIGIN=https://yourdomain.com

# Database
DATABASE_URL=postgresql://raven_user:YOUR_PASSWORD@localhost:5432/raven_oracle

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=YOUR_GENERATED_SECRET_HERE

# Discord OAuth (optional)
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=https://yourdomain.com/api/auth/discord/callback

# X OAuth (optional)
X_CLIENT_ID=your_x_client_id
X_CLIENT_SECRET=your_x_client_secret
X_REDIRECT_URI=https://yourdomain.com/api/auth/x/callback

# Email Configuration (optional)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
EMAIL_FROM_NAME=Raven Oracle

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5.2 Create Web Environment File

```bash
# Navigate to Web directory
cd /home/raven/raven-oracle/apps/web

# Create .env.local file
nano .env.local
```

Add the following:

```env
# API URL (production)
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
```

### 5.3 Generate JWT Secret

```bash
# Generate secure JWT secret
openssl rand -base64 32
```

Copy the output and update `JWT_SECRET` in API .env file.

### 5.4 Set File Permissions

```bash
# Secure environment files
chmod 600 /home/raven/raven-oracle/apps/api/.env
chmod 600 /home/raven/raven-oracle/apps/web/.env.local

# Verify
ls -la /home/raven/raven-oracle/apps/api/.env
ls -la /home/raven/raven-oracle/apps/web/.env.local
```

---

## Step 6: Database Migration

### 6.1 Run Migrations

```bash
# Navigate to project root
cd /home/raven/raven-oracle

# Run migrations
npx prisma migrate deploy

# Expected output:
# ✓ Applied migrations: [list of migrations]
```

### 6.2 Verify Schema

```bash
# Check database
psql -h localhost -U raven_user -d raven_oracle

# List tables
\dt

# Should show:
# User, Project, Raffle, RaffleEntry, etc.

# Exit
\q
```

### 6.3 Create Initial Admin User (Optional)

```bash
# You can create admin user via API after deployment
# Or create seed script
```

---

## Step 7: Build Applications

### 7.1 Build API

```bash
# Navigate to API directory
cd /home/raven/raven-oracle/apps/api

# Run TypeScript compiler
npm run build

# Verify dist/ directory created
ls -la dist/

# Should show compiled .js files
```

### 7.2 Build Web Application

```bash
# Navigate to Web directory
cd /home/raven/raven-oracle/apps/web

# Build Next.js app
npm run build

# Expected output:
# ✓ Compiled successfully
# Route (app)                Size     First Load JS
# ...

# Verify .next/ directory created
ls -la .next/
```

### 7.3 Verify Builds

```bash
# Check for build artifacts
ls -la /home/raven/raven-oracle/apps/api/dist/
ls -la /home/raven/raven-oracle/apps/web/.next/
```

---

## Step 8: PM2 Process Management

### 8.1 Create PM2 Ecosystem File

```bash
# Navigate to project root
cd /home/raven/raven-oracle

# Create ecosystem file
nano ecosystem.config.js
```

Add the following:

```javascript
module.exports = {
  apps: [
    {
      name: 'raven-api',
      cwd: '/home/raven/raven-oracle/apps/api',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/raven/logs/api-error.log',
      out_file: '/home/raven/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_memory_restart: '500M',
    },
    {
      name: 'raven-web',
      cwd: '/home/raven/raven-oracle/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/raven/logs/web-error.log',
      out_file: '/home/raven/logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_memory_restart: '500M',
    },
  ],
};
```

### 8.2 Create Log Directory

```bash
# Create logs directory
mkdir -p /home/raven/logs

# Set permissions
chmod 755 /home/raven/logs
```

### 8.3 Start Applications with PM2

```bash
# Navigate to project root
cd /home/raven/raven-oracle

# Start applications
pm2 start ecosystem.config.js

# Check status
pm2 status

# Should show:
# │ id │ name       │ status │
# ├────┼────────────┼────────┤
# │ 0  │ raven-api  │ online │
# │ 1  │ raven-web  │ online │
```

### 8.4 Configure PM2 Startup

```bash
# Generate startup script
pm2 startup systemd -u raven --hp /home/raven

# Copy and run the command it outputs
# Then save PM2 configuration
pm2 save

# Verify
sudo systemctl status pm2-raven
```

### 8.5 PM2 Management Commands

```bash
# View logs
pm2 logs

# View specific app logs
pm2 logs raven-api
pm2 logs raven-web

# Restart apps
pm2 restart all
pm2 restart raven-api
pm2 restart raven-web

# Stop apps
pm2 stop all
pm2 stop raven-api

# Delete apps
pm2 delete all
pm2 delete raven-api

# Monitor
pm2 monit
```

---

## Step 9: Nginx Configuration

### 9.1 Create Nginx Configuration

```bash
# Create site configuration
sudo nano /etc/nginx/sites-available/raven-oracle
```

Add the following (replace `yourdomain.com`):

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=web_limit:10m rate=30r/s;

# Upstream servers
upstream raven_api {
    server localhost:4000;
    keepalive 64;
}

upstream raven_web {
    server localhost:3000;
    keepalive 64;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (Certbot will add these)
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Client body size limit
    client_max_body_size 10M;

    # Logging
    access_log /var/log/nginx/raven-access.log;
    error_log /var/log/nginx/raven-error.log;

    # API Proxy
    location /api {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://raven_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # Web Application Proxy
    location / {
        limit_req zone=web_limit burst=50 nodelay;

        proxy_pass http://raven_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # Static files caching
    location /_next/static {
        proxy_cache_valid 200 60m;
        proxy_pass http://raven_web;
        add_header Cache-Control "public, max-age=3600, immutable";
    }

    # Favicon
    location /favicon.ico {
        proxy_pass http://raven_web;
        access_log off;
        log_not_found off;
    }
}
```

### 9.2 Enable Site Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/raven-oracle /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Should show:
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Reload Nginx
sudo systemctl reload nginx
```

### 9.3 Configure Nginx Security

```bash
# Edit main Nginx configuration
sudo nano /etc/nginx/nginx.conf
```

Ensure these settings are present:

```nginx
http {
    # Hide Nginx version
    server_tokens off;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    # Buffer sizes
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;
}
```

```bash
# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 10: SSL/HTTPS Setup

### 10.1 Obtain SSL Certificate

```bash
# Stop Nginx temporarily
sudo systemctl stop nginx

# Obtain certificate (replace email and domain)
sudo certbot certonly --standalone \
  --agree-tos \
  --non-interactive \
  --email your-email@example.com \
  -d yourdomain.com \
  -d www.yourdomain.com

# Expected output:
# Successfully received certificate.
# Certificate is saved at: /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# Key is saved at: /etc/letsencrypt/live/yourdomain.com/privkey.pem

# Start Nginx
sudo systemctl start nginx
```

### 10.2 Update Nginx Configuration

```bash
# Edit site configuration
sudo nano /etc/nginx/sites-available/raven-oracle
```

Uncomment the SSL lines:

```nginx
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

```bash
# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 10.3 Configure Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Should show:
# Congratulations, all simulated renewals succeeded

# Certbot auto-renewal is configured via systemd timer
sudo systemctl status certbot.timer

# Certificate will auto-renew 30 days before expiration
```

### 10.4 Test SSL

```bash
# Test HTTPS access
curl -I https://yourdomain.com

# Should show: HTTP/2 200
```

---

## Step 11: Backup Configuration

### 11.1 Create Backup Script

```bash
# Create backup directory
mkdir -p /home/raven/backups

# Create backup script
nano /home/raven/backup.sh
```

Add the following:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/home/raven/backups"
DB_NAME="raven_oracle"
DB_USER="raven_user"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup
echo "Starting backup at $(date)"

# Database backup
pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > "$BACKUP_DIR/db_${DATE}.sql.gz"

# Application backup (optional)
cd /home/raven/raven-oracle
tar -czf "$BACKUP_DIR/app_${DATE}.tar.gz" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='.env.local' \
  .

# Remove old backups
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "app_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed at $(date)"
```

```bash
# Make executable
chmod +x /home/raven/backup.sh

# Test backup
/home/raven/backup.sh

# Verify
ls -lh /home/raven/backups/
```

### 11.2 Schedule Daily Backups

```bash
# Edit crontab
crontab -e
```

Add the following:

```cron
# Daily backup at 2 AM
0 2 * * * /home/raven/backup.sh >> /home/raven/logs/backup.log 2>&1
```

```bash
# Verify crontab
crontab -l
```

### 11.3 Test Restoration

```bash
# Test database restoration (DO NOT RUN ON PRODUCTION)
# This is for testing only

# Create test database
sudo -u postgres psql -c "CREATE DATABASE raven_oracle_test;"

# Restore backup
gunzip -c /home/raven/backups/db_YYYYMMDD_HHMMSS.sql.gz | \
  psql -U raven_user -h localhost raven_oracle_test

# Drop test database
sudo -u postgres psql -c "DROP DATABASE raven_oracle_test;"
```

---

## Step 12: Monitoring Setup

### 12.1 Health Check Endpoint

The API already has a health check endpoint at `/api/health`.

Test it:

```bash
# Test health endpoint
curl https://yourdomain.com/api/health

# Expected response:
# {"status":"ok"}
```

### 12.2 Create Monitoring Script

```bash
# Create monitoring script
nano /home/raven/monitor.sh
```

Add the following:

```bash
#!/bin/bash

# Configuration
HEALTH_URL="https://yourdomain.com/api/health"
EMAIL="your-email@example.com"
LOG_FILE="/home/raven/logs/monitor.log"

# Check health
response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $response -ne 200 ]; then
  echo "$(date): ALERT - Health check failed with status $response" >> $LOG_FILE
  
  # Send email alert (requires mailutils installed)
  # echo "Raven Oracle health check failed" | mail -s "Alert: API Down" $EMAIL
  
  # Restart services
  pm2 restart all
  
  echo "$(date): Services restarted" >> $LOG_FILE
else
  echo "$(date): Health check OK" >> $LOG_FILE
fi
```

```bash
# Make executable
chmod +x /home/raven/monitor.sh

# Test
/home/raven/monitor.sh
cat /home/raven/logs/monitor.log
```

### 12.3 Schedule Monitoring

```bash
# Edit crontab
crontab -e
```

Add the following:

```cron
# Health check every 5 minutes
*/5 * * * * /home/raven/monitor.sh
```

### 12.4 Log Rotation

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/raven-oracle
```

Add the following:

```
/home/raven/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 raven raven
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}

/var/log/nginx/raven-*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
```

```bash
# Test logrotate
sudo logrotate -d /etc/logrotate.d/raven-oracle
```

---

## Step 13: Deployment Verification

### 13.1 Verify Services Running

```bash
# Check PM2 status
pm2 status

# Should show both apps online

# Check Nginx
sudo systemctl status nginx

# Should show active (running)

# Check PostgreSQL
sudo systemctl status postgresql

# Should show active (running)
```

### 13.2 Test Web Application

```bash
# Test HTTPS
curl -I https://yourdomain.com

# Should show: HTTP/2 200

# Test API health
curl https://yourdomain.com/api/health

# Should show: {"status":"ok"}

# Test API registration (optional)
curl -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'

# Should show user created or error if exists
```

### 13.3 Check Logs

```bash
# PM2 logs
pm2 logs --lines 50

# Nginx access logs
sudo tail -f /var/log/nginx/raven-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/raven-error.log

# Application logs
tail -f /home/raven/logs/api-out.log
tail -f /home/raven/logs/web-out.log
```

### 13.4 Performance Check

```bash
# Check server resources
free -h       # Memory usage
df -h         # Disk usage
top           # CPU and process usage

# Check PM2 resource usage
pm2 monit
```

### 13.5 Security Scan

```bash
# Check open ports
sudo netstat -tuln | grep LISTEN

# Should only show: 22 (SSH), 80 (HTTP), 443 (HTTPS), 5432 (PostgreSQL localhost only)

# Test firewall
sudo ufw status

# Should show: 22, 80, 443 allowed
```

---

## Maintenance Procedures

### Deploy Updates

```bash
# Navigate to project
cd /home/raven/raven-oracle

# Backup database first
/home/raven/backup.sh

# Pull latest code
git pull origin main

# Install dependencies
npm install
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build applications
cd apps/api && npm run build && cd ../..
cd apps/web && npm run build && cd ../..

# Restart services
pm2 restart all

# Verify
pm2 status
curl https://yourdomain.com/api/health
```

### Rollback Procedure

```bash
# If deployment fails, rollback:

# Navigate to project
cd /home/raven/raven-oracle

# Revert to previous commit
git log --oneline -5       # Find previous commit hash
git reset --hard <commit-hash>

# Restore database (if needed)
gunzip -c /home/raven/backups/db_YYYYMMDD_HHMMSS.sql.gz | \
  psql -U raven_user -h localhost -d raven_oracle

# Rebuild
cd apps/api && npm run build && cd ../..
cd apps/web && npm run build && cd ../..

# Restart
pm2 restart all
```

### Database Maintenance

```bash
# Analyze database
psql -U raven_user -d raven_oracle -c "ANALYZE;"

# Vacuum database (reclaim space)
psql -U raven_user -d raven_oracle -c "VACUUM;"

# Check database size
psql -U raven_user -d raven_oracle -c "SELECT pg_size_pretty(pg_database_size('raven_oracle'));"
```

---

## Troubleshooting

### PM2 App Not Starting

```bash
# Check logs
pm2 logs raven-api --lines 100
pm2 logs raven-web --lines 100

# Common issues:
# - Missing .env file
# - Wrong DATABASE_URL
# - Port already in use
# - Build failed

# Restart manually
cd /home/raven/raven-oracle/apps/api
node dist/server.js

# Check for errors
```

### Database Connection Failed

```bash
# Check PostgreSQL running
sudo systemctl status postgresql

# Check connection
psql -U raven_user -d raven_oracle

# Check credentials in .env
cat /home/raven/raven-oracle/apps/api/.env | grep DATABASE_URL

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Nginx 502 Bad Gateway

```bash
# Check if apps are running
pm2 status

# Check ports
netstat -tuln | grep 3000
netstat -tuln | grep 4000

# Restart apps
pm2 restart all

# Check Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/raven-error.log
```

### SSL Certificate Issues

```bash
# Check certificate
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal

# Test renewal
sudo certbot renew --dry-run
```

### High CPU/Memory Usage

```bash
# Check resources
pm2 monit

# Restart apps
pm2 restart all

# Check for memory leaks in logs
pm2 logs --lines 500 | grep -i memory
```

---

## Security Checklist

Before going live, verify:

- [x] Firewall configured (only 22, 80, 443 open)
- [x] SSH key-based authentication enabled
- [x] Root login disabled
- [x] PostgreSQL only listening on localhost
- [x] Strong database password set
- [x] JWT_SECRET is cryptographically random (32+ characters)
- [x] All .env files have 600 permissions
- [x] No .env files committed to Git
- [x] HTTPS enabled with valid certificate
- [x] Security headers configured in Nginx
- [x] Rate limiting enabled
- [x] CORS configured to production domain
- [x] NODE_ENV=production set
- [x] Error messages do not expose stack traces
- [x] Admin endpoints require authentication
- [x] Backups configured and tested
- [x] Monitoring configured
- [x] Log rotation configured
- [x] Dependencies up to date (npm audit)
- [x] OAuth redirect URIs set to production URLs

---

## Quick Reference Commands

```bash
# PM2
pm2 status                 # Check status
pm2 logs                   # View logs
pm2 restart all            # Restart all apps
pm2 monit                  # Monitor resources

# Nginx
sudo nginx -t              # Test configuration
sudo systemctl reload nginx # Reload
sudo tail -f /var/log/nginx/raven-error.log  # View logs

# Database
psql -U raven_user -d raven_oracle  # Connect
pg_dump -U raven_user raven_oracle > backup.sql  # Backup

# System
sudo ufw status            # Firewall status
free -h                    # Memory usage
df -h                      # Disk usage
sudo systemctl status <service>  # Service status

# Application
cd /home/raven/raven-oracle
git pull                   # Update code
npm run build              # Build apps
pm2 restart all            # Restart

# Health Check
curl https://yourdomain.com/api/health
```

---

## Support

For issues or questions:

- **Repository:** https://github.com/labraven3/raven-oracle
- **Documentation:** See `/docs` folder
- **Logs:** Check `/home/raven/logs/` and `/var/log/nginx/`

---

**Deployment Guide Version:** 1.0  
**Last Updated:** August 19, 2026  
**Status:** Production Ready ✅
