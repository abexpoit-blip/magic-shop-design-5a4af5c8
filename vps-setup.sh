#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/cruzercc"
REPO_URL="https://github.com/abexpoit-blip/magic-shop-design.git"

echo "══════════════════════════════════════════"
echo "  CRUZERCC.SHOP — VPS SETUP"
echo "══════════════════════════════════════════"

echo "→ [1/5] Installing system packages..."
apt-get update -qq
apt-get install -y -qq curl git nginx sqlite3 ca-certificates

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]; then
  echo "→ Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

echo "→ [2/5] Installing PM2..."
npm install -g pm2 >/dev/null 2>&1 || true

echo "→ [3/5] Cloning or updating repository..."
mkdir -p /var/www
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin main
  git reset --hard origin/main
else
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

echo "→ [4/5] Running production deploy..."
chmod +x "$APP_DIR/deploy.sh"
"$APP_DIR/deploy.sh"

echo "→ [5/5] Enabling PM2 startup..."
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
pm2 save

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ SETUP COMPLETE"
echo "══════════════════════════════════════════"
echo "  Site: https://cruzercc.shop"
echo "  API:  https://cruzercc.shop/api/health"
echo ""
echo "  Default logins after first deploy:"
echo "  Admin  → admin@cruzercc.shop / Admin@2026!"
echo "  Seller → seller@cruzercc.shop / Seller@2026!"
echo "  Buyer  → buyer@cruzercc.shop / Buyer@2026!"
echo ""
echo "  Optional SSL if not already installed:"
echo "  apt-get install -y certbot python3-certbot-nginx"
echo "  certbot --nginx -d cruzercc.shop -d www.cruzercc.shop"
echo "══════════════════════════════════════════"
