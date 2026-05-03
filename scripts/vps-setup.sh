#!/usr/bin/env bash
set -euo pipefail

#──────────────────────────────────────────────────────
# cruzercc VPS setup & diagnostics script
# Run on your VPS:  bash scripts/vps-setup.sh
#──────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*"; }

echo "═══════════════════════════════════════"
echo " cruzercc.shop — VPS Setup"
echo "═══════════════════════════════════════"
echo ""

PROJECT_DIR="/var/www/cruzercc"
if [ ! -d "$PROJECT_DIR" ]; then
  fail "Project directory $PROJECT_DIR does not exist!"
  exit 1
fi
ok "Project directory: $PROJECT_DIR"
cd "$PROJECT_DIR"

# ── Pull latest code ──
echo ""
echo "── Pulling latest code ──"
git pull origin main || warn "git pull failed — continuing"

# ── Backend ──
echo ""
echo "── Checking backend ──"
BACKEND_DIR="$PROJECT_DIR/backend"
if [ ! -d "$BACKEND_DIR" ]; then
  fail "Backend directory not found at $BACKEND_DIR"
  exit 1
fi
cd "$BACKEND_DIR"

# Install deps
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ] 2>/dev/null; then
  echo "  Installing backend dependencies..."
  npm install --production 2>&1 | tail -3
fi
ok "Backend dependencies installed"

# Check .env
if [ ! -f ".env" ]; then
  warn "No .env file in backend/. Creating template..."
  cat > .env << 'ENVEOF'
PORT=8080
DATABASE_URL=postgresql://cruzercc:YOUR_DB_PASSWORD@localhost:5432/cruzercc
JWT_SECRET=CHANGE_ME_TO_A_RANDOM_SECRET
CORS_ORIGIN=*
ENVEOF
  fail "Edit backend/.env with your actual database credentials and JWT secret, then re-run!"
  exit 1
fi
ok "Backend .env exists"

# Build
if [ -f "tsconfig.json" ]; then
  echo "  Building backend..."
  npm run build 2>&1 | tail -3 || warn "Build had issues"
fi

# PM2
echo ""
echo "── Starting/restarting backend ──"
BACKEND_PORT=$(grep -oP 'PORT=\K\d+' .env 2>/dev/null || echo "8080")

if command -v pm2 &>/dev/null; then
  pm2 delete cruzercc-api 2>/dev/null || true
  if [ -f "ecosystem.config.cjs" ]; then
    pm2 start ecosystem.config.cjs
  elif [ -f "dist/server.js" ]; then
    pm2 start dist/server.js --name cruzercc-api
  elif [ -f "server.js" ]; then
    pm2 start server.js --name cruzercc-api
  else
    fail "Cannot find server entry point (dist/server.js or server.js)"
    exit 1
  fi
  pm2 save
  ok "Backend started on port $BACKEND_PORT"
else
  warn "PM2 not installed: npm install -g pm2"
fi

# Test local
echo ""
sleep 2
if curl -sf http://127.0.0.1:${BACKEND_PORT}/api/health > /dev/null 2>&1; then
  ok "Backend responds on port ${BACKEND_PORT}"
else
  fail "Backend NOT responding on port ${BACKEND_PORT}"
  echo "  Check: pm2 logs cruzercc-api --lines 50"
fi

# ── SSL for cruzercc.shop ──
echo ""
echo "── SSL certificate ──"
CERT_PATH="/etc/letsencrypt/live/cruzercc.shop/fullchain.pem"
if [ ! -f "$CERT_PATH" ]; then
  warn "No SSL cert for cruzercc.shop — obtaining one..."
  sudo certbot --nginx -d cruzercc.shop -d www.cruzercc.shop --non-interactive --agree-tos --email admin@cruzercc.shop || {
    warn "certbot failed. Try manually: sudo certbot --nginx -d cruzercc.shop -d www.cruzercc.shop"
  }
else
  ok "SSL cert exists for cruzercc.shop"
fi

# ── Nginx ──
echo ""
echo "── Setting up Nginx ──"
cd "$PROJECT_DIR"

NGINX_SRC="nginx/cruzercc.conf"
NGINX_DEST="/etc/nginx/sites-available/cruzercc.conf"
NGINX_LINK="/etc/nginx/sites-enabled/cruzercc.conf"

if [ ! -f "$NGINX_SRC" ]; then
  fail "Nginx config not found at $NGINX_SRC"
  exit 1
fi

# Update port if non-default
if [ "$BACKEND_PORT" != "8080" ]; then
  sed -i "s/127.0.0.1:8080/127.0.0.1:${BACKEND_PORT}/g" "$NGINX_SRC"
fi

sudo cp "$NGINX_SRC" "$NGINX_DEST"
sudo ln -sf "$NGINX_DEST" "$NGINX_LINK"

# Remove old API-only config if it exists
sudo rm -f /etc/nginx/sites-enabled/cruzercc-api.conf 2>/dev/null || true

if sudo nginx -t 2>&1; then
  sudo systemctl reload nginx
  ok "Nginx configured and reloaded"
else
  fail "Nginx config test failed — fix errors above"
fi

# ── Final test ──
echo ""
echo "── Final verification ──"
sleep 1

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://cruzercc.shop/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  ok "https://cruzercc.shop/api/health → 200 ✓"
else
  warn "https://cruzercc.shop/api/health → HTTP $HTTP_CODE"
  echo "  DNS may still be propagating, or SSL cert is not yet ready"
fi

echo ""
echo "═══════════════════════════════════════"
echo " Done! API endpoint: https://cruzercc.shop/api"
echo " Admin login: https://cruzercc.shop/admin-login"
echo "═══════════════════════════════════════"
