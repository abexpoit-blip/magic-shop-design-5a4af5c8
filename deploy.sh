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

# Upload frontend dist
rsync -avz --delete dist/ $VPS_USER@$VPS_HOST:$APP_DIR/frontend/

# Upload backend (dist + package.json + node_modules)
rsync -avz --delete \
  backend/dist/ \
  $VPS_USER@$VPS_HOST:$APP_DIR/backend/dist/

rsync -avz \
  backend/package.json \
  backend/package-lock.json \
  backend/ecosystem.config.cjs \
  backend/scripts/ \
  $VPS_USER@$VPS_HOST:$APP_DIR/backend/

# ── 4. Install deps & restart on VPS ──
echo "→ Installing backend deps & restarting…"
ssh $VPS_USER@$VPS_HOST << 'EOF'
  set -e
  cd /var/www/cruzercc/backend
  npm ci --production

  # Run migrations
  npx tsx scripts/migrate.ts 2>/dev/null || echo "Migrations: nothing new"

  # Restart
  pm2 reload cruzercc-api --update-env 2>/dev/null || pm2 start ecosystem.config.cjs
  sudo nginx -t && sudo systemctl reload nginx
  echo "✅ VPS deploy complete"
EOF

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Deploy finished!"
echo "  Frontend: https://cruzercc.shop"
echo "  API:      https://cruzercc.shop/api"
echo "══════════════════════════════════════════"
