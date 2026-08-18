# Raven Oracle - Quick Start Deployment

**Time Required:** ~2 hours  
**Difficulty:** Intermediate  
**Prerequisites:** Basic Linux knowledge, SSH access to server

---

## Overview

This guide provides a streamlined deployment process for Raven Oracle. For detailed explanations, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

---

## Prerequisites Checklist

- [ ] Ubuntu 20.04+ server with root access
- [ ] Domain name pointing to server IP
- [ ] SSH access configured
- [ ] 2GB+ RAM, 20GB+ storage

---

## Step 1: Server Preparation (15 minutes)

```bash
# SSH into server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Create user
adduser raven
usermod -aG sudo raven
su - raven

# Configure firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Step 2: Install Software (20 minutes)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install PM2
sudo npm install -g pm2

# Install Git
sudo apt install -y git

# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Verify installations
node --version
npm --version
psql --version
nginx -v
pm2 --version
```

---

## Step 3: Database Setup (10 minutes)

```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE raven_oracle;
CREATE USER raven_user WITH ENCRYPTED PASSWORD 'CHANGE_THIS_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE raven_oracle TO raven_user;
\c raven_oracle
GRANT ALL ON SCHEMA public TO raven_user;
\q
EOF

# Test connection
psql -h localhost -U raven_user -d raven_oracle
# Enter password when prompted
# Type \q to exit
```

---

## Step 4: Clone and Build (20 minutes)

```bash
# Clone repository
cd ~
git clone https://github.com/labraven3/raven-oracle.git
cd raven-oracle

# Install dependencies
npm install
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..

# Generate Prisma Client
npx prisma generate
```

---

## Step 5: Configure Environment (15 minutes)

```bash
# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "Your JWT Secret: $JWT_SECRET"

# Create API .env
cd ~/raven-oracle/apps/api
cat > .env << 'EOF'
NODE_ENV=production
PORT=4000
WEB_ORIGIN=https://yourdomain.com
DATABASE_URL=postgresql://raven_user:YOUR_DB_PASSWORD@localhost:5432/raven_oracle
JWT_SECRET=YOUR_JWT_SECRET_HERE
EOF

# IMPORTANT: Edit .env and replace:
# - yourdomain.com with your actual domain
# - YOUR_DB_PASSWORD with your PostgreSQL password
# - YOUR_JWT_SECRET_HERE with the generated JWT secret
nano .env

# Secure .env
chmod 600 .env

# Create Web .env.local
cd ~/raven-oracle/apps/web
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
EOF

# Edit and replace yourdomain.com
nano .env.local

# Secure .env.local
chmod 600 .env.local
```

---

## Step 6: Database Migration (5 minutes)

```bash
# Navigate to project root
cd ~/raven-oracle

# Run migrations
npx prisma migrate deploy

# Verify
psql -U raven_user -d raven_oracle -c "\dt"
# Should show tables: User, Project, Raffle, etc.
```

---

## Step 7: Build Applications (15 minutes)

```bash
# Navigate to project root
cd ~/raven-oracle

# Build API
cd apps/api
npm run build
cd ../..

# Build Web
cd apps/web
npm run build
cd ../..

# Verify builds
ls -la apps/api/dist/
ls -la apps/web/.next/
```

---

## Step 8: Start with PM2 (10 minutes)

```bash
# Navigate to project root
cd ~/raven-oracle

# Create logs directory
mkdir -p ~/logs

# Start applications
pm2 start ecosystem.config.js

# Check status
pm2 status
# Both apps should show "online"

# Save PM2 configuration
pm2 save

# Configure PM2 to start on boot
pm2 startup systemd -u raven --hp /home/raven
# Copy and run the command it outputs

# View logs
pm2 logs --lines 20
```

---

## Step 9: Configure Nginx (15 minutes)

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/raven-oracle
```

Paste this configuration (replace `yourdomain.com`):

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=web_limit:10m rate=30r/s;

upstream raven_api {
    server localhost:4000;
    keepalive 64;
}

upstream raven_web {
    server localhost:3000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates will be added by Certbot

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 10M;

    access_log /var/log/nginx/raven-access.log;
    error_log /var/log/nginx/raven-error.log;

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
    }

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
    }

    location /_next/static {
        proxy_pass http://raven_web;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/raven-oracle /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Step 10: Setup SSL (10 minutes)

```bash
# Stop Nginx temporarily
sudo systemctl stop nginx

# Obtain SSL certificate (replace email and domain)
sudo certbot certonly --standalone \
  --agree-tos \
  --non-interactive \
  --email your-email@example.com \
  -d yourdomain.com \
  -d www.yourdomain.com

# Start Nginx
sudo systemctl start nginx

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## Step 11: Configure Backups (10 minutes)

```bash
# Make backup script executable
chmod +x ~/raven-oracle/scripts/backup.sh

# Test backup
DB_PASSWORD=YOUR_DB_PASSWORD ~/raven-oracle/scripts/backup.sh

# Verify backup created
ls -lh ~/backups/

# Schedule daily backups
crontab -e

# Add this line:
0 2 * * * DB_PASSWORD=YOUR_DB_PASSWORD /home/raven/raven-oracle/scripts/backup.sh >> /home/raven/logs/backup.log 2>&1
```

---

## Step 12: Configure Monitoring (10 minutes)

```bash
# Make monitor script executable
chmod +x ~/raven-oracle/scripts/monitor.sh

# Test monitoring
HEALTH_URL=http://localhost:4000/api/health ~/raven-oracle/scripts/monitor.sh

# Check log
cat ~/logs/monitor.log

# Schedule health checks every 5 minutes
crontab -e

# Add this line:
*/5 * * * * HEALTH_URL=http://localhost:4000/api/health /home/raven/raven-oracle/scripts/monitor.sh
```

---

## Step 13: Verification (10 minutes)

```bash
# Check all services
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql

# Test health endpoint
curl http://localhost:4000/api/health
# Should return: {"status":"ok"}

# Test HTTPS
curl -I https://yourdomain.com
# Should return: HTTP/2 200

# Test API through Nginx
curl https://yourdomain.com/api/health
# Should return: {"status":"ok"}

# Check logs
pm2 logs --lines 50
```

---

## Post-Deployment Checklist

- [ ] All services running (pm2 status shows "online")
- [ ] Health check passes (curl /api/health returns ok)
- [ ] HTTPS works (https://yourdomain.com loads)
- [ ] Firewall configured (ufw status shows only 22, 80, 443)
- [ ] Backups scheduled (crontab -l shows backup job)
- [ ] Monitoring scheduled (crontab -l shows monitor job)
- [ ] SSL auto-renewal configured (certbot renew --dry-run succeeds)
- [ ] .env files secured (ls -la shows 600 permissions)
- [ ] Logs directory created (ls ~/logs/)
- [ ] PM2 startup configured (pm2 list shows apps after reboot)

---

## Create First Admin User

```bash
# Option 1: Via API (after deployment)
curl -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourdomain.com",
    "password": "SecureAdminPassword123!",
    "username": "admin"
  }'

# Then update user role in database:
psql -U raven_user -d raven_oracle -c \
  "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'admin@yourdomain.com';"

# Option 2: Direct database insert
psql -U raven_user -d raven_oracle
# Run SQL to create admin user
```

---

## Common Issues

### Port Already in Use
```bash
# Check what's using the port
sudo netstat -tuln | grep 4000
sudo kill <PID>
pm2 restart all
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection manually
psql -U raven_user -d raven_oracle

# Check DATABASE_URL in .env
cat ~/raven-oracle/apps/api/.env | grep DATABASE_URL
```

### SSL Certificate Failed
```bash
# Check DNS is pointing to server
dig yourdomain.com

# Check firewall allows 80/443
sudo ufw status

# Try again
sudo certbot renew --force-renewal
```

### App Won't Start
```bash
# Check logs
pm2 logs --lines 100

# Try running manually to see error
cd ~/raven-oracle/apps/api
node dist/server.js
```

---

## Next Steps

1. **Create Admin Account** - See section above
2. **Configure OAuth** - Add Discord/X credentials to .env
3. **Test User Registration** - Create test user account
4. **Test Raffle Creation** - Create and test a raffle
5. **Monitor Logs** - Watch for errors: `pm2 logs -f`
6. **Review Security** - See DEPLOYMENT_GUIDE.md security checklist

---

## Updating Deployment

```bash
cd ~/raven-oracle
git pull
npm ci
cd apps/api && npm ci && cd ../..
cd apps/web && npm ci && cd ../..
npx prisma generate
npx prisma migrate deploy
cd apps/api && npm run build && cd ../..
cd apps/web && npm run build && cd ../..
pm2 restart all
pm2 logs --lines 20
```

Or use the automated script:

```bash
chmod +x ~/raven-oracle/scripts/deploy.sh
~/raven-oracle/scripts/deploy.sh
```

---

## Getting Help

- **Logs:** `pm2 logs`, `/var/log/nginx/raven-error.log`
- **Status:** `pm2 status`, `sudo systemctl status nginx`
- **Documentation:** See `/docs` folder
- **Repository:** https://github.com/labraven3/raven-oracle

---

## Time Summary

| Step | Time | Total |
|------|------|-------|
| 1. Server Preparation | 15 min | 15 min |
| 2. Install Software | 20 min | 35 min |
| 3. Database Setup | 10 min | 45 min |
| 4. Clone and Build | 20 min | 65 min |
| 5. Configure Environment | 15 min | 80 min |
| 6. Database Migration | 5 min | 85 min |
| 7. Build Applications | 15 min | 100 min |
| 8. Start with PM2 | 10 min | 110 min |
| 9. Configure Nginx | 15 min | 125 min |
| 10. Setup SSL | 10 min | 135 min |
| 11. Configure Backups | 10 min | 145 min |
| 12. Configure Monitoring | 10 min | 155 min |
| 13. Verification | 10 min | 165 min |

**Total Time:** ~2.75 hours (165 minutes)

---

**Quick Start Guide Version:** 1.0  
**Last Updated:** August 19, 2026  
**Status:** Production Ready ✅
