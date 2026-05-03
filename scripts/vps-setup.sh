#!/usr/bin/env bash
set -euo pipefail

#──────────────────────────────────────────────────────
# cruzercc VPS setup & diagnostics script
# Run on your VPS:  bash scripts/vps-setup.sh
#──────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*"; }

echo "═══════════════════════════════════════"
echo " cruzercc.shop — VPS Setup & Diagnose"
echo "═══════════════════════════════════════"
echo ""

# ── 1. Check project directory ──
PROJECT_DIR="/var/www/cruzercc"
if [ ! -d "$PROJECT_DIR" ]; then
  fail "Project directory $PROJECT_DIR does not exist!"
  echo "  Clone the repo: git clone <repo-url> $PROJECT_DIR"
  exit 1
fi
ok "Project directory: $PROJECT_DIR"
cd "$PROJECT_DIR"

# ── 2. Pull latest code ──
echo ""
echo "── Pulling latest code ──"
git pull origin main || warn "git pull failed — continuing with existing code"

# ── 3. Check backend ──
echo ""
echo "── Checking backend ──"
BACKEND_DIR="$PROJECT_DIR/backend"
if [ ! -d "$BACKEND_DIR" ]; then
  fail "Backend directory not found at $BACKEND_DIR"
  exit 1
fi
ok "Backend directory exists"

cd "$BACKEND_DIR"

# Install dependencies
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ] 2>/dev/null; then
  echo "  Installing backend dependencies..."
  npm install --production 2>&1 | tail -3
fi
ok "Backend dependencies installed"

# Check if .env exists
if [ ! -f ".env" ]; then
  warn "No .env file in backend/. Creating template..."
  cat > .env << 'ENVEOF'
PORT=8080
DATABASE_URL=postgresql://cruzercc:YOUR_DB_PASSWORD@localhost:5432/cruzercc
JWT_SECRET=CHANGE_ME_TO_A_RANDOM_SECRET
CORS_ORIGIN=https://cruzercc.shop,https://www.cruzercc.shop,https://7ea76888-d94a-4592-ac34-e07723f22854.lovableproject.com
ENVEOF
  fail "Edit backend/.env with your actual database credentials and JWT secret!"
  echo "  Then re-run this script."
  exit 1
fi
ok "Backend .env exists"

# Build TypeScript
if [ -f "tsconfig.json" ]; then
  echo "  Building backend TypeScript..."
  npx tsc --noEmit 2>/dev/null || true
  npm run build 2>&1 | tail -3 || {
    warn "Backend build failed — check for TypeScript errors"
  }
fi

# ── 4. Check if backend is running ──
echo ""
echo "── Checking backend process ──"
BACKEND_PORT=$(grep -oP 'PORT=\K\d+' .env 2>/dev/null || echo "8080")

if command -v pm2 &>/dev/null; then
  PM2_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
  procs = json.load(sys.stdin)
  for p in procs:
    if 'cruzercc' in p.get('name','').lower():
      print(f\"{p['name']}: {p['pm2_env']['status']}\")
except: pass
" 2>/dev/null || true)
  
  if [ -n "$PM2_STATUS" ]; then
    ok "PM2 process found: $PM2_STATUS"
  else
    warn "No cruzercc PM2 process found"
    echo "  Starting backend with PM2..."
    
    # Use ecosystem config if it exists
    if [ -f "ecosystem.config.cjs" ]; then
      pm2 start ecosystem.config.cjs
    else
      pm2 start dist/server.js --name cruzercc-api --env production
    fi
    pm2 save
    ok "Backend started with PM2"
  fi
else
  warn "PM2 not installed. Install with: npm install -g pm2"
  echo "  Then start the backend: pm2 start dist/server.js --name cruzercc-api"
fi

# Test if backend responds locally
echo ""
echo "── Testing backend locally ──"
if curl -sf http://127.0.0.1:${BACKEND_PORT}/api/health > /dev/null 2>&1; then
  HEALTH=$(curl -s http://127.0.0.1:${BACKEND_PORT}/api/health)
  ok "Backend responds on port ${BACKEND_PORT}: $HEALTH"
else
  fail "Backend NOT responding on port ${BACKEND_PORT}"
  echo "  Check: pm2 logs cruzercc-api"
  echo "  Or:    ss -tlnp | grep ${BACKEND_PORT}"
fi

# ── 5. Setup Nginx ──
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

# Update port in config if needed
if [ "$BACKEND_PORT" != "8080" ]; then
  sed -i "s/127.0.0.1:8080/127.0.0.1:${BACKEND_PORT}/g" "$NGINX_SRC"
  ok "Updated nginx config to use port ${BACKEND_PORT}"
fi

# Check SSL certs
CERT_PATH="/etc/letsencrypt/live/cruzercc.shop/fullchain.pem"
if [ ! -f "$CERT_PATH" ]; then
  warn "SSL cert not found at $CERT_PATH"
  echo "  Run: sudo certbot certonly --nginx -d cruzercc.shop -d www.cruzercc.shop"
  echo "  Or update the cert paths in $NGINX_SRC"
fi

# Install nginx config
echo "  Installing nginx config..."
sudo cp "$NGINX_SRC" "$NGINX_DEST"
sudo ln -sf "$NGINX_DEST" "$NGINX_LINK"

# Remove default site if it conflicts
if [ -f "/etc/nginx/sites-enabled/default" ]; then
  sudo rm /etc/nginx/sites-enabled/default 2>/dev/null || true
  warn "Removed default nginx site to prevent conflicts"
fi

# Test and reload
if sudo nginx -t 2>&1; then
  sudo systemctl reload nginx
  ok "Nginx config installed and reloaded"
else
  fail "Nginx config test failed!"
  echo "  Fix the errors above, then: sudo nginx -t && sudo systemctl reload nginx"
fi

# ── 6. Final verification ──
echo ""
echo "── Final verification ──"
sleep 1

# Test /api/health through nginx
if curl -sf http://127.0.0.1/api/health -H "Host: cruzercc.shop" > /dev/null 2>&1; then
  HEALTH=$(curl -s http://127.0.0.1/api/health -H "Host: cruzercc.shop")
  ok "Nginx → Backend proxy works: $HEALTH"
else
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/api/health -H "Host: cruzercc.shop" 2>/dev/null || echo "000")
  fail "Nginx → Backend proxy failed (HTTP $RESPONSE)"
  echo "  Check: sudo nginx -t && sudo tail -20 /var/log/nginx/error.log"
fi

# Test /api/auth/admin-login endpoint exists
if curl -sf -X POST http://127.0.0.1:${BACKEND_PORT}/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test","password":"test"}' -o /dev/null -w "%{http_code}" 2>/dev/null | grep -qE "401|400"; then
  ok "Admin login endpoint responds (returns 401 for bad creds — expected)"
else
  warn "Admin login endpoint did not return expected status"
fi

echo ""
echo "═══════════════════════════════════════"
echo " Summary"
echo "═══════════════════════════════════════"
echo ""
echo " 1. Make sure your DNS A record for cruzercc.shop"
echo "    points ONLY to this server's IP (not Cloudflare proxy)"
echo ""
echo " 2. If using Cloudflare, set DNS to 'DNS only' (gray cloud)"
echo "    so SSL terminates on your VPS with Let's Encrypt"
echo ""
echo " 3. Test from outside: curl https://cruzercc.shop/api/health"
echo ""
echo " 4. Admin login: https://cruzercc.shop/admin-login"
echo ""
echo "═══════════════════════════════════════"
