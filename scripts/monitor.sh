#!/bin/bash

################################################################################
# Raven Oracle Health Monitoring Script
# 
# This script monitors the health of the Raven Oracle application and
# automatically restarts services if they become unresponsive.
#
# Usage: ./monitor.sh
# Schedule: Add to crontab for periodic execution (every 5 minutes)
################################################################################

# Configuration
HEALTH_URL="${HEALTH_URL:-http://localhost:4000/api/health}"
LOG_FILE="${HOME}/logs/monitor.log"
MAX_FAILURES=3
FAILURE_COUNT_FILE="${HOME}/.monitor_failures"

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Initialize failure counter if it doesn't exist
if [ ! -f "$FAILURE_COUNT_FILE" ]; then
  echo "0" > "$FAILURE_COUNT_FILE"
fi

# Read current failure count
FAILURES=$(cat "$FAILURE_COUNT_FILE")

# Function to log messages
log_message() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Function to send alert (customize as needed)
send_alert() {
  local message="$1"
  log_message "ALERT: $message"
  
  # Uncomment to enable email alerts (requires mailutils installed)
  # echo "$message" | mail -s "Raven Oracle Alert" your-email@example.com
}

# Perform health check
log_message "Performing health check..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$HEALTH_URL")

if [ "$RESPONSE" -eq 200 ]; then
  # Health check passed
  log_message "✓ Health check OK (HTTP $RESPONSE)"
  
  # Reset failure counter
  echo "0" > "$FAILURE_COUNT_FILE"
  
else
  # Health check failed
  FAILURES=$((FAILURES + 1))
  echo "$FAILURES" > "$FAILURE_COUNT_FILE"
  
  log_message "✗ Health check FAILED (HTTP $RESPONSE) - Failure $FAILURES/$MAX_FAILURES"
  
  if [ "$FAILURES" -ge "$MAX_FAILURES" ]; then
    # Maximum failures reached - restart services
    send_alert "Health check failed $FAILURES times. Restarting services..."
    
    log_message "Restarting PM2 services..."
    pm2 restart all >> "$LOG_FILE" 2>&1
    
    if [ $? -eq 0 ]; then
      log_message "✓ Services restarted successfully"
      send_alert "Services restarted successfully"
    else
      log_message "✗ Failed to restart services"
      send_alert "CRITICAL: Failed to restart services!"
    fi
    
    # Reset failure counter
    echo "0" > "$FAILURE_COUNT_FILE"
    
    # Wait a bit for services to start
    sleep 10
    
    # Verify services are running
    log_message "Verifying services..."
    pm2 status >> "$LOG_FILE" 2>&1
    
    # Test health check again
    VERIFY_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$HEALTH_URL")
    
    if [ "$VERIFY_RESPONSE" -eq 200 ]; then
      log_message "✓ Services recovered successfully"
      send_alert "Services recovered successfully after restart"
    else
      log_message "✗ Services still unhealthy after restart (HTTP $VERIFY_RESPONSE)"
      send_alert "CRITICAL: Services still unhealthy after restart!"
    fi
  fi
fi

# Check PM2 process status
log_message "Checking PM2 processes..."
PM2_STATUS=$(pm2 jlist 2>/dev/null)

if [ $? -eq 0 ]; then
  # Count stopped processes
  STOPPED_PROCESSES=$(echo "$PM2_STATUS" | grep -c '"status":"stopped"')
  
  if [ "$STOPPED_PROCESSES" -gt 0 ]; then
    log_message "✗ Warning: $STOPPED_PROCESSES PM2 processes are stopped"
    send_alert "$STOPPED_PROCESSES PM2 processes are stopped"
    
    log_message "Attempting to restart stopped processes..."
    pm2 restart all >> "$LOG_FILE" 2>&1
  else
    log_message "✓ All PM2 processes are running"
  fi
else
  log_message "✗ Failed to check PM2 status"
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
log_message "Disk usage: ${DISK_USAGE}%"

if [ "$DISK_USAGE" -gt 90 ]; then
  log_message "✗ Warning: Disk usage is above 90%"
  send_alert "Disk usage is critical: ${DISK_USAGE}%"
fi

# Check memory usage
MEM_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3*100/$2}')
log_message "Memory usage: ${MEM_USAGE}%"

if [ "$MEM_USAGE" -gt 90 ]; then
  log_message "✗ Warning: Memory usage is above 90%"
  send_alert "Memory usage is critical: ${MEM_USAGE}%"
fi

log_message "Health check completed"
echo "" >> "$LOG_FILE"
