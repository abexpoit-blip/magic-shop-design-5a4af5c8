#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Manual deploy script: GitHub → VPS (161.97.100.218)
# Usage:  ./deploy.sh
# Prereq: SSH key access to root@161.97.100.218
# ──────────────────────────────────────────────────────────────
set -euo pipefail

VPS_HOST="161.97.100.218"
VPS_USER="root"
APP_DIR="/var/www/cruzercc"
REPO_URL="https://github.com/abexpoit-blip/magic-shop-design.git"

echo "══════════════════════════════════════════"
echo "  CRUZERCC.SHOP — Deploy to VPS"
echo "══════════════════════════════════════════"

# ── 1. Build frontend locally ──
echo "→ Building frontend…"
npm ci
VITE_API_BASE=/api npm run build

# ── 2. Build backend locally ──
echo "→ Building backend…"
cd backend
npm ci
npm run build
cd ..

# ── 3. Upload to VPS ──
echo "→ Uploading to VPS ($VPS_HOST)…"

# Sync repo to VPS app dir
rsync -avz --delete \
  --exclude node_modules \
  --exclude backend/node_modules \
  --exclude .git \
  ./ $VPS_USER@$VPS_HOST:$APP_DIR/

# ── 4. Install deps & restart on VPS ──
echo "→ Installing backend deps & restarting…"
ssh $VPS_USER@$VPS_HOST << 'EOF'
  set -e

  cd /var/www/cruzercc
  npm ci
  VITE_API_BASE=/api npm run build
  mkdir -p /var/www/cruzercc/frontend
  rm -rf /var/www/cruzercc/frontend/*
  cp -r dist/* /var/www/cruzercc/frontend/

  cd /var/www/cruzercc/backend
  npm ci --production
  npm run build

  # Run migrations
  npx tsx scripts/migrate.ts 2>/dev/null || echo "Migrations: nothing new"

  # Restart
  pm2 reload cruzercc-api --update-env 2>/dev/null || pm2 start ecosystem.config.cjs
  pm2 save
  test -f /var/www/cruzercc/frontend/index.html
  grep -q '/assets/' /var/www/cruzercc/frontend/index.html
  curl -sf http://127.0.0.1:8080/api/health > /dev/null
  sudo nginx -t && sudo systemctl reload nginx
  echo "✅ VPS deploy complete"
EOF

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Deploy finished!"
echo "  Frontend: https://cruzercc.shop"
echo "  API:      https://cruzercc.shop/api"
echo "══════════════════════════════════════════"
