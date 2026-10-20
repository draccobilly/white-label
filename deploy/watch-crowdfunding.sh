#!/bin/bash
# Keep :3001 alive without dropping paid campaign traffic.
# Never `pm2 restart` an online process — that 502s every live ad click.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
for nvm_bin in /root/.nvm/versions/node/*/bin; do
  if [ -d "$nvm_bin" ]; then
    PATH="$nvm_bin:$PATH"
  fi
done

DEPLOY_LOCK=/tmp/crowdfunding-deploy.lock
if [ -f "$DEPLOY_LOCK" ]; then
  now=$(date +%s)
  stamp=$(stat -c %Y "$DEPLOY_LOCK" 2>/dev/null || echo 0)
  if [ $((now - stamp)) -lt 1200 ]; then
    exit 0
  fi
fi

LOCK=/tmp/crowdfunding-watch.lock
FAILS=/tmp/crowdfunding-watch.fails

port_open() {
  timeout 1 bash -c 'echo >/dev/tcp/127.0.0.1/3001' 2>/dev/null
}

healthy() {
  curl -fsS -o /dev/null --connect-timeout 2 --max-time 8 http://127.0.0.1:3001/api/health \
    || curl -fsS -o /dev/null --connect-timeout 2 --max-time 8 http://127.0.0.1:3001/login
}

if healthy; then
  rm -f "$FAILS"
  insight_stamp=/tmp/crowdfunding-insights.stamp
  now=$(date +%s)
  prev=0
  if [ -f "$insight_stamp" ]; then
    prev=$(stat -c %Y "$insight_stamp" 2>/dev/null || echo 0)
  fi
  if [ $((now - prev)) -ge 3600 ]; then
    touch "$insight_stamp"
    secret=$(grep -E '^INSIGHT_CRON_SECRET=' /var/www/crowdfunding/.env 2>/dev/null | head -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [ -n "$secret" ]; then
      curl -fsS -o /dev/null --connect-timeout 2 --max-time 25 \
        -H "Authorization: Bearer $secret" \
        -X POST http://127.0.0.1:3001/api/internal/insight-alerts || true
    fi
  fi
  exit 0
fi

# Slow is not down. An open port means Next is still serving paid traffic.
# PM2 can stay "online" after the listener dies; that is the sticky 502.
if port_open; then
  logger -t crowdfunding-watch "health slow but port 3001 is open — not restarting"
  rm -f "$FAILS"
  exit 0
fi

count=0
if [ -f "$FAILS" ]; then
  count=$(cat "$FAILS" 2>/dev/null || echo 0)
fi
count=$((count + 1))
echo "$count" > "$FAILS"

if [ "$count" -lt 3 ]; then
  logger -t crowdfunding-watch "port 3001 down ($count/3), waiting before start"
  exit 0
fi

if [ -f "$LOCK" ]; then
  now=$(date +%s)
  stamp=$(stat -c %Y "$LOCK" 2>/dev/null || echo 0)
  if [ $((now - stamp)) -lt 300 ]; then
    exit 0
  fi
fi

touch "$LOCK"
if ! command -v pm2 >/dev/null 2>&1; then
  logger -t crowdfunding-watch "pm2 not in PATH"
  exit 1
fi
cd /var/www/crowdfunding
export NODE_TLS_REJECT_UNAUTHORIZED=0
if pm2 describe crowdfunding >/dev/null 2>&1; then
  logger -t crowdfunding-watch "port 3001 closed, restarting crowdfunding"
  pm2 restart crowdfunding --update-env
else
  logger -t crowdfunding-watch "port 3001 down and process missing, starting ecosystem"
  pm2 start ecosystem.config.cjs
  pm2 save
fi
rm -f "$FAILS"
