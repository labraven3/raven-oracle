# Systemd Setup Guide

This guide explains how to use systemd as an alternative to PM2 for managing Raven Oracle services.

## Overview

Systemd is a system and service manager built into most Linux distributions. It provides:

- Automatic service restart on failure
- Service dependency management
- Resource limiting
- Integrated logging
- Boot-time startup

## Prerequisites

- Ubuntu 16.04+ or any Linux with systemd
- Root or sudo access
- Raven Oracle built and ready to run

## Installation

### 1. Create Logs Directory

```bash
mkdir -p /home/raven/logs
chmod 755 /home/raven/logs
```

### 2. Copy Service Files

```bash
# Copy service files to systemd directory
sudo cp /home/raven/raven-oracle/systemd/raven-api.service /etc/systemd/system/
sudo cp /home/raven/raven-oracle/systemd/raven-web.service /etc/systemd/system/

# Set correct permissions
sudo chmod 644 /etc/systemd/system/raven-api.service
sudo chmod 644 /etc/systemd/system/raven-web.service
```

### 3. Update Service Files (if needed)

If your installation paths are different, edit the service files:

```bash
sudo nano /etc/systemd/system/raven-api.service
sudo nano /etc/systemd/system/raven-web.service
```

Update these paths:
- `WorkingDirectory`
- `EnvironmentFile`
- `ExecStart`
- `StandardOutput`
- `StandardError`
- `ReadWritePaths`

### 4. Reload Systemd

```bash
sudo systemctl daemon-reload
```

### 5. Enable Services (Start on Boot)

```bash
sudo systemctl enable raven-api.service
sudo systemctl enable raven-web.service
```

### 6. Start Services

```bash
sudo systemctl start raven-api.service
sudo systemctl start raven-web.service
```

### 7. Verify Services

```bash
# Check status
sudo systemctl status raven-api.service
sudo systemctl status raven-web.service

# Both should show "active (running)"
```

## Service Management

### Check Status

```bash
# Both services
sudo systemctl status raven-*.service

# Individual service
sudo systemctl status raven-api.service
sudo systemctl status raven-web.service
```

### Start Services

```bash
sudo systemctl start raven-api.service
sudo systemctl start raven-web.service
```

### Stop Services

```bash
sudo systemctl stop raven-api.service
sudo systemctl stop raven-web.service
```

### Restart Services

```bash
sudo systemctl restart raven-api.service
sudo systemctl restart raven-web.service
```

### Reload Configuration

After modifying service files:

```bash
sudo systemctl daemon-reload
sudo systemctl restart raven-api.service
sudo systemctl restart raven-web.service
```

### Enable/Disable Auto-Start

```bash
# Enable (start on boot)
sudo systemctl enable raven-api.service

# Disable (don't start on boot)
sudo systemctl disable raven-api.service
```

## Viewing Logs

### Real-time Logs

```bash
# Follow logs for both services
sudo journalctl -u raven-api.service -u raven-web.service -f

# Follow API logs only
sudo journalctl -u raven-api.service -f

# Follow Web logs only
sudo journalctl -u raven-web.service -f
```

### Recent Logs

```bash
# Last 100 lines
sudo journalctl -u raven-api.service -n 100

# Last 1 hour
sudo journalctl -u raven-api.service --since "1 hour ago"

# Today's logs
sudo journalctl -u raven-api.service --since today
```

### Log Files

Logs are also written to:
- `/home/raven/logs/api-out.log` (API output)
- `/home/raven/logs/api-error.log` (API errors)
- `/home/raven/logs/web-out.log` (Web output)
- `/home/raven/logs/web-error.log` (Web errors)

```bash
# Tail log files
tail -f /home/raven/logs/api-out.log
tail -f /home/raven/logs/web-out.log
```

## Troubleshooting

### Service Won't Start

```bash
# Check for errors
sudo systemctl status raven-api.service
sudo journalctl -u raven-api.service -n 50

# Common issues:
# - Wrong file paths in service file
# - Missing .env file
# - Node.js not installed
# - Build not completed
# - Port already in use
```

### Service Crashes Immediately

```bash
# View detailed logs
sudo journalctl -u raven-api.service --no-pager

# Test running manually
cd /home/raven/raven-oracle/apps/api
node dist/server.js

# Check environment variables
cat /home/raven/raven-oracle/apps/api/.env
```

### Permission Issues

```bash
# Check file ownership
ls -la /home/raven/raven-oracle/apps/api/dist/

# Fix ownership if needed
sudo chown -R raven:raven /home/raven/raven-oracle

# Check log directory permissions
ls -la /home/raven/logs/

# Fix permissions if needed
sudo chown -R raven:raven /home/raven/logs
```

### Port Already in Use

```bash
# Check what's using the port
sudo netstat -tuln | grep 4000
sudo netstat -tuln | grep 3000

# Kill process if needed
sudo kill <PID>
```

## Upgrading Services

After deploying new code:

```bash
# Navigate to project
cd /home/raven/raven-oracle

# Pull, build, migrate (see DEPLOYMENT_GUIDE.md)
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
cd apps/api && npm run build && cd ../..
cd apps/web && npm run build && cd ../..

# Restart services
sudo systemctl restart raven-api.service
sudo systemctl restart raven-web.service

# Verify
sudo systemctl status raven-*.service
```

## Performance Monitoring

### Resource Usage

```bash
# Show resource usage
sudo systemctl status raven-api.service

# Look for:
# - Memory usage
# - CPU usage
# - Uptime
```

### Memory Limit

Services are limited to 512MB by default. To change:

```bash
sudo nano /etc/systemd/system/raven-api.service

# Change this line:
MemoryLimit=1G

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart raven-api.service
```

## Security Features

The service files include security hardening:

- `NoNewPrivileges=true` - Prevents privilege escalation
- `PrivateTmp=true` - Isolated /tmp directory
- `ProtectSystem=strict` - Read-only system directories
- `ProtectHome=read-only` - Limited home directory access
- `ReadWritePaths=/home/raven/logs` - Only logs are writable

## Comparison: PM2 vs Systemd

### PM2 Advantages
- Easier log management (`pm2 logs`)
- Built-in monitoring dashboard (`pm2 monit`)
- Zero-downtime reloads
- Simple cluster mode
- Cross-platform (works on Windows)

### Systemd Advantages
- Native to Linux (no additional installation)
- Better resource limiting
- Integrated with system logs
- More secure by default
- Better service dependency management
- Automatically handles crashes at boot time

### Recommendation

- **Development/Small Projects:** PM2 is easier to use
- **Production/Enterprise:** Systemd is more robust
- **Both:** You can use both! PM2 can be managed by systemd

## Using Both PM2 and Systemd

You can use PM2 for process management and systemd to manage PM2:

```bash
# Install PM2
npm install -g pm2

# Start apps with PM2
pm2 start ecosystem.config.js

# Generate systemd service for PM2
pm2 startup systemd -u raven --hp /home/raven

# Run the command it outputs, then:
pm2 save

# Now PM2 is managed by systemd
sudo systemctl status pm2-raven.service
```

This gives you the best of both worlds!

## Uninstallation

To remove systemd services:

```bash
# Stop services
sudo systemctl stop raven-api.service
sudo systemctl stop raven-web.service

# Disable auto-start
sudo systemctl disable raven-api.service
sudo systemctl disable raven-web.service

# Remove service files
sudo rm /etc/systemd/system/raven-api.service
sudo rm /etc/systemd/system/raven-web.service

# Reload systemd
sudo systemctl daemon-reload
```

## Additional Resources

- [Systemd Documentation](https://www.freedesktop.org/wiki/Software/systemd/)
- [Digital Ocean Systemd Guide](https://www.digitalocean.com/community/tutorials/how-to-use-systemctl-to-manage-systemd-services-and-units)
- [Arch Linux Systemd Guide](https://wiki.archlinux.org/title/Systemd)

---

**Last Updated:** August 19, 2026
