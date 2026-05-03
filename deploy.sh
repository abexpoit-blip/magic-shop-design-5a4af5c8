#!/bin/bash
set -e

APP=/var/www/cruzercc
EXPECTED_TITLE="cruzercc.shop"
BACKEND_ENV="$APP/backend/.env"

check_html_contains() {
  local url="$1"
  local expected="$2"
  local body
  body=$(curl -fsSL "$url") || return 1
  printf '%s' "$body" | grep -Fqi "$expected"
}

check_json_health() {
  local url="$1"
  local headers body status content_type
  headers=$(mktemp)
  body=$(mktemp)
  status=$(curl -sS -D "$headers" -o "$body" -w "%{http_code}" "$url" || true)
  content_type=$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {print tolower($0)}' "$headers" | tail -n 1)
  if [ "$status" != "200" ]; then
    rm -f "$headers" "$body"
    return 1
  fi
  if [[ "$content_type" != *"application/json"* ]]; then
    rm -f "$headers" "$body"
    return 1
  fi
  if ! grep -q '"ok":true' "$body"; then
    rm -f "$headers" "$body"
    return 1
  fi
  rm -f "$headers" "$body"
}

check_auth_endpoint() {
  local url="$1"
  local payload="$2"
  local expected_status="$3"
  local headers body status content_type
  headers=$(mktemp)
  body=$(mktemp)
  status=$(curl -sS -D "$headers" -o "$body" -w "%{http_code}" -X POST "$url" -H 'Content-Type: application/json' --data "$payload" || true)
  content_type=$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {print tolower($0)}' "$headers" | tail -n 1)
  if [ "$status" != "$expected_status" ]; then
    rm -f "$headers" "$body"
    return 1
  fi
  if [[ "$content_type" != *"application/json"* ]]; then
    rm -f "$headers" "$body"
    return 1
  fi
  if ! grep -q '"token"\|"error"' "$body"; then
    rm -f "$headers" "$body"
    return 1
  fi
  rm -f "$headers" "$body"
}

echo "🚀 Deploying cruzercc.shop..."

cd $APP
git fetch origin main
git reset --hard origin/main

# Frontend
echo "📦 Building frontend..."
npm install
VITE_API_BASE=/api npm run build
mkdir -p $APP/frontend
rm -rf $APP/frontend/*
cp -r dist/* $APP/frontend/

# Backend
echo "📦 Building backend..."
cd $APP/backend
npm install
npm run build

# Seed test accounts (idempotent — safe to run every deploy)
echo "🌱 Seeding accounts..."
cd $APP/backend
npx tsx scripts/seed-admin.ts

# Restart API
echo "♻️ Restarting API..."
pm2 reload cruzercc-api --update-env 2>/dev/null || pm2 start $APP/backend/ecosystem.config.cjs
pm2 save

BACKEND_PORT=$(grep -oP '^PORT=\K\d+' "$BACKEND_ENV" 2>/dev/null || echo "8080")

# Nginx
echo "🔄 Reloading nginx..."
sed "s|127.0.0.1:8080|127.0.0.1:${BACKEND_PORT}|g" "$APP/nginx/cruzercc.conf" > /etc/nginx/sites-available/cruzercc
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/cruzercc /etc/nginx/sites-enabled/cruzercc.conf /etc/nginx/sites-enabled/cruzercc-api.conf
ln -sf /etc/nginx/sites-available/cruzercc /etc/nginx/sites-enabled/cruzercc
nginx -t && systemctl reload nginx

ok=false
for i in $(seq 1 15); do
  if check_json_health "http://127.0.0.1:${BACKEND_PORT}/api/health"; then
    echo "✅ Healthy JSON API: http://127.0.0.1:${BACKEND_PORT}/api/health"
    ok=true
    break
  fi
  sleep 2
done
if [ "$ok" = false ]; then
  echo "❌ Local API health check failed"
  exit 1
fi

ok=false
for i in $(seq 1 15); do
  if check_html_contains "https://cruzercc.shop/" "$EXPECTED_TITLE"; then
    echo "✅ Frontend live: https://cruzercc.shop/"
    ok=true
    break
  fi
  sleep 2
done
if [ "$ok" = false ]; then
  echo "❌ Public frontend check failed: wrong site or stale nginx root"
  exit 1
fi

ok=false
for i in $(seq 1 15); do
  if check_json_health "https://cruzercc.shop/api/health"; then
    echo "✅ Public API health: https://cruzercc.shop/api/health"
    ok=true
    break
  fi
  sleep 2
done
if [ "$ok" = false ]; then
  echo "❌ Public API health check failed: /api/health is not returning JSON from this app"
  exit 1
fi

ok=false
for i in $(seq 1 10); do
  if check_auth_endpoint "https://cruzercc.shop/api/auth/admin-login" '{"identifier":"admin@cruzercc.shop","password":"Admin@2026!"}' "200" && \
     check_auth_endpoint "https://cruzercc.shop/api/auth/seller-login" '{"identifier":"seller@cruzercc.shop","password":"Seller@2026!"}' "200" && \
     check_auth_endpoint "https://cruzercc.shop/api/auth/login" '{"identifier":"buyer@cruzercc.shop","password":"Buyer@2026!"}' "200"; then
    echo "✅ Login APIs verified for admin, seller, and buyer"
    ok=true
    break
  fi
  sleep 2
done
if [ "$ok" = false ]; then
  echo "❌ Public login API verification failed"
  exit 1
fi

echo "✅ Deploy complete!"
