#!/bin/bash
# First-time setup on a fresh Ubuntu VPS. Does not write Stripe, PayPal, Supabase, or Utmify secrets.
# After this, fill /var/www/crowdfunding/.env and run deploy/apply-ngo-vps.sh

set -euo pipefail

APP_DIR="/var/www/crowdfunding"
REPO="${NGO_GIT_REMOTE:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root on the VPS."
  exit 1
fi

if [ -z "$REPO" ]; then
  echo "Set NGO_GIT_REMOTE to this organization's private git URL, for example:"
  echo "  NGO_GIT_REMOTE=git@github.com:ORG/REPO.git bash deploy/bootstrap-ngo-vps.sh"
  exit 1
fi

mkdir -p /var/www /var/www/letsencrypt
if [ -f /root/.ssh/ngo_deploy ]; then
  chmod 600 /root/.ssh/ngo_deploy
  mkdir -p /root/.ssh
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

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" reset --hard origin/main
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  sed 's/\r$//' deploy/ngo.vps.env.example > .env
  chmod 600 .env
  echo "Created $APP_DIR/.env from the example. Fill the real keys, then re-run apply."
else
  echo "$APP_DIR/.env already exists — left it unchanged."
fi

echo
echo "Next:"
echo "  1. DNS A  SITE_DOMAIN  →  this VPS public IP"
echo "  2. Edit   $APP_DIR/.env   (nano .env — Stripe, PayPal, Supabase, ENCRYPTION_KEY)"
echo "  3. bash   $APP_DIR/deploy/apply-ngo-vps.sh"
echo "  4. SSL:   certbot certonly --webroot -w /var/www/letsencrypt -d SITE_DOMAIN"
echo "            bash $APP_DIR/deploy/apply-ngo-vps.sh"
echo "  5. Stripe webhook https://SITE_DOMAIN/api/webhooks/stripe"
echo "     npx tsx scripts/create-stripe-webhook.ts"
