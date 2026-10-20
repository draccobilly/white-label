#!/bin/bash
# Publish this storefront on the VPS. Reads SITE_DOMAIN from .env.
# Never copies secrets from another machine. Fill .env with nano before the first run.

set -euo pipefail
cd /var/www/crowdfunding

DEPLOY_LOCK=/tmp/crowdfunding-deploy.lock
touch "$DEPLOY_LOCK"
trap 'rm -f "$DEPLOY_LOCK"' EXIT

if [ ! -f .env ]; then
  echo "Missing /var/www/crowdfunding/.env"
  echo "Copy deploy/ngo.vps.env.example, fill the keys with nano, then re-run."
  exit 1
fi

env_value() {
  local key="$1"
  grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r' | sed 's|#.*||' | xargs
}

SITE_DOMAIN="${SITE_DOMAIN:-$(env_value SITE_DOMAIN)}"
if [ -z "$SITE_DOMAIN" ]; then
  APP_URL="$(env_value NEXT_PUBLIC_APP_URL)"
  if [ -n "$APP_URL" ]; then
    SITE_DOMAIN="$(python3 - <<PY
from urllib.parse import urlparse
print(urlparse("$APP_URL").hostname or "")
PY
)"
  fi
fi
if [ -z "$SITE_DOMAIN" ]; then
  echo "Set SITE_DOMAIN=giving.example.org in .env (the public hostname)."
  exit 1
fi

APP_NAME_VALUE="$(env_value APP_NAME)"
if [ -z "$APP_NAME_VALUE" ]; then
  APP_NAME_VALUE="Giving Site"
fi

# GitHub main is the only source of truth. .env is gitignored and kept.
if [ -f /root/.ssh/ngo_deploy ]; then
  chmod 600 /root/.ssh/ngo_deploy
  mkdir -p /root/.ssh
  chmod 700 /root/.ssh
  if [ ! -f /root/.ssh/config ] || ! grep -q "IdentityFile /root/.ssh/ngo_deploy" /root/.ssh/config; then
    cat >> /root/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile /root/.ssh/ngo_deploy
  IdentitiesOnly yes
EOF
    chmod 600 /root/.ssh/config
  fi
fi
git fetch origin
git reset --hard origin/main

PUBLIC_URL="https://${SITE_DOMAIN}"
CERT="/etc/letsencrypt/live/${SITE_DOMAIN}/fullchain.pem"

grep -q '^APP_ROLE=' .env && sed -i 's/^APP_ROLE=.*/APP_ROLE=all/' .env || echo 'APP_ROLE=all' >> .env
grep -q '^TZ=' .env && sed -i "s|^TZ=.*|TZ=${TZ:-America/Los_Angeles}|" .env || echo "TZ=${TZ:-America/Los_Angeles}" >> .env
grep -q '^NEXT_ASSET_PREFIX=' .env && sed -i 's|^NEXT_ASSET_PREFIX=.*|NEXT_ASSET_PREFIX=/__giving|' .env || echo 'NEXT_ASSET_PREFIX=/__giving' >> .env
grep -q '^NEXT_PUBLIC_APP_URL=' .env && sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=${PUBLIC_URL}|" .env || echo "NEXT_PUBLIC_APP_URL=${PUBLIC_URL}" >> .env
grep -q '^NEXT_PUBLIC_PUBLIC_SITE_URL=' .env && sed -i "s|^NEXT_PUBLIC_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_PUBLIC_SITE_URL=${PUBLIC_URL}|" .env || echo "NEXT_PUBLIC_PUBLIC_SITE_URL=${PUBLIC_URL}" >> .env
grep -q '^LOCAL_ADMIN_BYPASS=' .env && sed -i 's/^LOCAL_ADMIN_BYPASS=.*/LOCAL_ADMIN_BYPASS=false/' .env || true
grep -q '^APP_NAME=' .env || echo "APP_NAME=\"${APP_NAME_VALUE}\"" >> .env
grep -q '^SITE_DOMAIN=' .env && sed -i "s|^SITE_DOMAIN=.*|SITE_DOMAIN=${SITE_DOMAIN}|" .env || echo "SITE_DOMAIN=${SITE_DOMAIN}" >> .env

export NEXT_ASSET_PREFIX=/__giving
export APP_ROLE=all
export NEXT_PUBLIC_APP_URL="$PUBLIC_URL"
export NEXT_PUBLIC_PUBLIC_SITE_URL="$PUBLIC_URL"

mkdir -p /var/www/letsencrypt

if [ -f deploy/watch-crowdfunding.sh ]; then
  sed 's/\r$//' deploy/watch-crowdfunding.sh > /usr/local/bin/watch-crowdfunding.sh
  chmod 755 /usr/local/bin/watch-crowdfunding.sh
fi
if [ -f deploy/crowdfunding-watch.cron ]; then
  sed 's/\r$//' deploy/crowdfunding-watch.cron > /etc/cron.d/crowdfunding-watch
  chmod 644 /etc/cron.d/crowdfunding-watch
fi

render_nginx() {
  local src="$1"
  local dest="$2"
  sed -e 's/\r$//' -e "s/__SITE_DOMAIN__/${SITE_DOMAIN}/g" "$src" > "$dest"
}

if [ -f "$CERT" ]; then
  render_nginx deploy/nginx-ngo.conf /etc/nginx/sites-available/ngo-crowdfunding
else
  echo "WARN: SSL cert missing for ${SITE_DOMAIN} — serving HTTP until certbot runs"
  render_nginx deploy/nginx-ngo-http.conf /etc/nginx/sites-available/ngo-crowdfunding
fi
ln -sf /etc/nginx/sites-available/ngo-crowdfunding /etc/nginx/sites-enabled/ngo-crowdfunding
rm -f /etc/nginx/sites-enabled/default
if nginx -t; then
  systemctl reload nginx
else
  echo "WARN: nginx config test failed — left previous running config in memory"
fi

npm ci

node <<'NODE'
const fs = require("fs");
const webpush = require("web-push");
const envPath = ".env";
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
function value(key) {
  const match = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match?.[1]?.trim() ?? "";
}
function upsert(key, next) {
  const line = `${key}=${next}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(env)) env = env.replace(re, line);
  else env = `${env.replace(/\s*$/, "")}\n${line}\n`;
}
if (!value("VAPID_PUBLIC_KEY") || !value("VAPID_PRIVATE_KEY")) {
  const keys = webpush.generateVAPIDKeys();
  upsert("VAPID_PUBLIC_KEY", keys.publicKey);
  upsert("VAPID_PRIVATE_KEY", keys.privateKey);
  upsert("NEXT_PUBLIC_VAPID_PUBLIC_KEY", keys.publicKey);
  console.log("Generated VAPID keys for admin sale push");
} else if (!value("NEXT_PUBLIC_VAPID_PUBLIC_KEY")) {
  upsert("NEXT_PUBLIC_VAPID_PUBLIC_KEY", value("VAPID_PUBLIC_KEY"));
}
if (!value("VAPID_SUBJECT")) {
  const admin = value("ADMIN_EMAIL").replace(/^"|"$/g, "");
  upsert("VAPID_SUBJECT", admin ? `mailto:${admin}` : "mailto:admin@example.com");
}
if (!value("INSIGHT_CRON_SECRET")) {
  upsert("INSIGHT_CRON_SECRET", require("crypto").randomBytes(24).toString("hex"));
}
fs.writeFileSync(envPath, env);
NODE

NODE_TLS_REJECT_UNAUTHORIZED=0 npx prisma db push
if ! grep -qE '^UTMIFY_API_TOKEN=.+' .env; then
  echo "WARN: UTMIFY_API_TOKEN is empty. Leave it empty until this organization has its own Utmify token."
fi
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx prisma/seed.ts
npm run build

NODE_TLS_REJECT_UNAUTHORIZED=0 pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "--- wait for :3001 ---"
for i in $(seq 1 45); do
  if curl -fsS -o /dev/null --max-time 3 http://127.0.0.1:3001/api/health \
    || curl -fsS -o /dev/null --max-time 3 http://127.0.0.1:3001/login; then
    echo "crowdfunding ready after ${i}s"
    break
  fi
  sleep 1
done

echo "--- internal checks ---"
curl -sI http://127.0.0.1:3001/api/health | head -n 1
curl -sI http://127.0.0.1:3001/ | head -n 1
curl -sI http://127.0.0.1:3001/news | head -n 1
curl -sI http://127.0.0.1:3001/track-your-donation | head -n 1
curl -sI http://127.0.0.1:3001/login | head -n 1

if [ ! -f "$CERT" ]; then
  echo "--- SSL ---"
  echo "Point DNS A ${SITE_DOMAIN} at this VPS, then:"
  echo "  certbot certonly --webroot -w /var/www/letsencrypt -d ${SITE_DOMAIN}"
  echo "  bash deploy/apply-ngo-vps.sh"
fi

echo "Stripe webhook: ${PUBLIC_URL}/api/webhooks/stripe"
echo "PayPal webhook: ${PUBLIC_URL}/api/webhooks/paypal"
echo "Supabase Site URL: ${PUBLIC_URL}"
echo "Auth callback: ${PUBLIC_URL}/auth/callback"
echo "Admin: ${PUBLIC_URL}/admin"
