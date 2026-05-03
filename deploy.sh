#!/bin/bash
set -e

APP=/var/www/cruzercc
EXPECTED_TITLE="cruzercc.shop"
BACKEND_ENV="$APP/backend/.env"

echo "🚀 Deploying cruzercc.shop..."

cd $APP
git fetch origin main
git reset --hard origin/main

# ────────────────────────────────────────────────
# 1. Frontend build
# ────────────────────────────────────────────────
echo "📦 Building frontend..."
npm install
VITE_API_BASE=/api npm run build
mkdir -p $APP/frontend
rm -rf $APP/frontend/*
cp -r dist/* $APP/frontend/

# ────────────────────────────────────────────────
# 2. Backend build
# ────────────────────────────────────────────────
echo "📦 Building backend..."
cd $APP/backend
npm install
npm run build

# ────────────────────────────────────────────────
# 3. Seed test accounts (idempotent)
# ────────────────────────────────────────────────
echo "🌱 Seeding accounts..."
cd $APP/backend
npx tsx scripts/seed-admin.ts || echo "⚠️ Seed failed (non-fatal)"

# ────────────────────────────────────────────────
# 4. Determine backend port
# ────────────────────────────────────────────────
BACKEND_PORT=$(grep -oP '^PORT=\K\d+' "$BACKEND_ENV" 2>/dev/null || echo "8080")
echo "📡 Backend port: $BACKEND_PORT"

# ────────────────────────────────────────────────
# 5. Kill anything already on that port (avoid EADDRINUSE)
# ────────────────────────────────────────────────
echo "🔪 Killing any process on port $BACKEND_PORT..."
fuser -k ${BACKEND_PORT}/tcp 2>/dev/null || true
sleep 1

# ────────────────────────────────────────────────
# 6. Restart API via PM2
# ────────────────────────────────────────────────
echo "♻️ Restarting API..."
cd $APP/backend
pm2 delete cruzercc-api 2>/dev/null || true
sleep 1
PORT=$BACKEND_PORT pm2 start ecosystem.config.cjs
pm2 save

# Wait for PM2 process to settle
sleep 3

# Check if PM2 process is actually running
if ! pm2 show cruzercc-api | grep -q "online"; then
  echo "❌ PM2 process not online. Checking logs:"
  pm2 logs cruzercc-api --lines 30 --nostream
  exit 1
fi

# ────────────────────────────────────────────────
# 7. Nginx — AGGRESSIVE cleanup of all conflicting configs
# ────────────────────────────────────────────────
echo "🔄 Setting up nginx..."

# Remove ALL possible conflicting site configs
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/cruzercc
rm -f /etc/nginx/sites-enabled/cruzercc.shop
rm -f /etc/nginx/sites-enabled/cruzercc.conf
rm -f /etc/nginx/sites-enabled/cruzercc-api
rm -f /etc/nginx/sites-enabled/cruzercc-api.conf
rm -f /etc/nginx/sites-available/cruzercc.shop
rm -f /etc/nginx/sites-available/cruzercc.conf
rm -f /etc/nginx/sites-available/cruzercc-api
rm -f /etc/nginx/sites-available/cruzercc-api.conf

# Also check for configs in conf.d that might claim our server names
for f in /etc/nginx/conf.d/*.conf; do
  [ -f "$f" ] || continue
  if grep -q "cruzercc" "$f" 2>/dev/null; then
    echo "  ⚠️ Removing conflicting conf.d file: $f"
    rm -f "$f"
  fi
done

# Write the canonical config with correct port
sed "s|127.0.0.1:8080|127.0.0.1:${BACKEND_PORT}|g" "$APP/nginx/cruzercc.conf" > /etc/nginx/sites-available/cruzercc

# Create single symlink
ln -sf /etc/nginx/sites-available/cruzercc /etc/nginx/sites-enabled/cruzercc

# Verify only one config references our server names
echo "  Nginx configs claiming cruzercc.shop:"
grep -rl "cruzercc.shop" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null || echo "  (none found — something is wrong)"

# Test and reload
if ! nginx -t; then
  echo "❌ Nginx config test failed!"
  nginx -t 2>&1
  exit 1
fi
systemctl reload nginx
echo "✅ Nginx reloaded"

# ────────────────────────────────────────────────
# 8. Health checks
# ────────────────────────────────────────────────

# 8a. Local API health
echo "🔍 Checking local API..."
ok=false
for i in $(seq 1 20); do
  resp=$(curl -sS -w "\n%{http_code}" "http://127.0.0.1:${BACKEND_PORT}/api/health" 2>/dev/null || true)
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | head -1)
  if [ "$code" = "200" ] && echo "$body" | grep -q '"ok":true'; then
    echo "✅ Local API healthy: http://127.0.0.1:${BACKEND_PORT}/api/health"
    ok=true
    break
  fi
  echo "  Attempt $i: HTTP $code — waiting..."
  sleep 2
done
if [ "$ok" = false ]; then
  echo "❌ Local API health check FAILED after 40s"
  echo "  Last response code: $code"
  echo "  Last body: $body"
  echo "  PM2 status:"
  pm2 status
  echo "  PM2 logs (last 20 lines):"
  pm2 logs cruzercc-api --lines 20 --nostream
  echo "  Checking if port $BACKEND_PORT is in use:"
  ss -tlnp | grep ":${BACKEND_PORT}" || echo "  Port not bound!"
  exit 1
fi

# 8b. Public frontend
echo "🔍 Checking public frontend..."
ok=false
for i in $(seq 1 10); do
  if curl -fsSL "https://cruzercc.shop/" 2>/dev/null | grep -Fqi "$EXPECTED_TITLE"; then
    echo "✅ Frontend live: https://cruzercc.shop/"
    ok=true
    break
  fi
  sleep 2
done
if [ "$ok" = false ]; then
  echo "❌ Public frontend check failed"
  exit 1
fi

# 8c. Public API health
echo "🔍 Checking public API..."
ok=false
for i in $(seq 1 10); do
  resp=$(curl -sS -w "\n%{http_code}" "https://cruzercc.shop/api/health" 2>/dev/null || true)
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | head -1)
  if [ "$code" = "200" ] && echo "$body" | grep -q '"ok":true'; then
    echo "✅ Public API healthy: https://cruzercc.shop/api/health"
    ok=true
    break
  fi
  echo "  Attempt $i: HTTP $code"
  sleep 2
done
if [ "$ok" = false ]; then
  echo "❌ Public API health check FAILED"
  echo "  This means nginx is NOT proxying /api/ to port $BACKEND_PORT"
  echo "  Current nginx config:"
  cat /etc/nginx/sites-available/cruzercc | grep -A2 "proxy_pass"
  echo "  All enabled site configs:"
  ls -la /etc/nginx/sites-enabled/
  exit 1
fi

# 8d. Login endpoint tests
echo "🔍 Testing login endpoints..."
FAIL=0

for pair in \
  "admin-login:admin@cruzercc.shop:Admin@2026!" \
  "seller-login:seller@cruzercc.shop:Seller@2026!" \
  "login:buyer@cruzercc.shop:Buyer@2026!"; do

  endpoint=$(echo "$pair" | cut -d: -f1)
  email=$(echo "$pair" | cut -d: -f2)
  password=$(echo "$pair" | cut -d: -f3)

  resp=$(curl -sS -w "\n%{http_code}" -X POST "https://cruzercc.shop/api/auth/${endpoint}" \
    -H 'Content-Type: application/json' \
    --data "{\"identifier\":\"${email}\",\"password\":\"${password}\"}" 2>/dev/null || true)
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')

  if [ "$code" = "200" ] && echo "$body" | grep -q '"token"'; then
    echo "  ✅ ${endpoint}: OK (HTTP 200, token received)"
  else
    echo "  ❌ ${endpoint}: FAILED (HTTP $code)"
    echo "     Response: $body"
    FAIL=1
  fi
done

if [ "$FAIL" = "1" ]; then
  echo "❌ Some login tests failed"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       ✅ DEPLOY COMPLETE — ALL CHECKS PASSED     ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  Frontend:  https://cruzercc.shop               ║"
echo "║  API:       https://cruzercc.shop/api/health     ║"
echo "║  Backend:   127.0.0.1:${BACKEND_PORT}                    ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  ADMIN  │ admin@cruzercc.shop  / Admin@2026!     ║"
echo "║  SELLER │ seller@cruzercc.shop / Seller@2026!    ║"
echo "║  BUYER  │ buyer@cruzercc.shop  / Buyer@2026!     ║"
echo "╚══════════════════════════════════════════════════╝"
