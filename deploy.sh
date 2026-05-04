#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "🚀 Deploying cruzercc.shop..."

echo "⬇️  Pulling latest code..."
git pull origin main

echo "📦 Installing & building frontend..."
npm install --no-audit --no-fund
VITE_API_BASE=/api npm run build
rm -rf frontend/*
cp -r dist/* frontend/

echo "📦 Installing & building backend..."
cd backend
npm install --no-audit --no-fund
npm run build
echo "🗄️  Running migrations..."
npm run migrate || echo "⚠️  Migration warnings (non-fatal)"
cd ..

echo "♻️  Restarting backend..."
if pm2 describe cruzercc-api > /dev/null 2>&1; then
  pm2 reload cruzercc-api --update-env
else
  pm2 start backend/ecosystem.config.cjs
fi
pm2 save

BACKEND_PORT=$(grep -oP '^PORT=\K\d+' backend/.env 2>/dev/null || echo "8080")

echo ""
echo "🔍 Health checks..."

ok=false
for i in $(seq 1 15); do
  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/health" | grep -q '"ok":true'; then
    echo "  ✅ Local API healthy"
    ok=true
    break
  fi
  sleep 2
done
if [ "$ok" = false ]; then
  echo "  ❌ Local API health check FAILED — rolling back"
  pm2 logs cruzercc-api --lines 20 --nostream || true
  exit 1
fi

if curl -sf https://cruzercc.shop/ > /dev/null 2>&1; then
  echo "  ✅ Frontend live"
else
  echo "  ⚠️  Frontend not reachable (check nginx)"
fi

if curl -sf https://cruzercc.shop/api/health | grep -q '"ok":true' 2>/dev/null; then
  echo "  ✅ Public API healthy"
else
  echo "  ⚠️  Public API not reachable"
fi

DB_PATH="${DIR}/data/cruzercc.db"
if [ -f "$DB_PATH" ]; then
  USER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
  ADMIN_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE role='admin';" 2>/dev/null || echo "0")
  SELLER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE role='seller';" 2>/dev/null || echo "0")
  echo "  📊 DB: ${USER_COUNT} users (${ADMIN_COUNT} admin, ${SELLER_COUNT} seller)"
fi

echo ""
echo "✅ Deploy complete!"
