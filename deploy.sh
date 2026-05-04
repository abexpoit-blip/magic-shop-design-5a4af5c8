#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "🚀 Deploying cruzercc.shop..."

echo "⬇️  Pulling latest code..."
git pull origin main

echo "📦 Installing & building frontend..."
npm install --no-audit --no-fund
npm run build

echo "📦 Installing & building backend..."
cd backend
npm install --no-audit --no-fund
npm run build
echo "🗄️  Running migrations..."
npm run migrate || echo "⚠️  Migration warnings (non-fatal)"
cd ..

echo "♻️  Restarting backend..."
pm2 restart cruzercc-api 2>/dev/null || pm2 start backend/dist/server.js --name cruzercc-api -i 1
pm2 save

echo ""
echo "🔍 Health checks..."

# Wait for backend to come up
sleep 2

# Check local API
if curl -sf http://127.0.0.1:8080/api/health > /dev/null 2>&1; then
  echo "  ✅ Local API healthy"
else
  echo "  ⚠️  Local API not responding yet (may still be starting)"
fi

# Check public site
if curl -sf https://cruzercc.shop/ > /dev/null 2>&1; then
  echo "  ✅ Frontend live"
else
  echo "  ⚠️  Frontend not reachable (check nginx)"
fi

# Check public API
if curl -sf https://cruzercc.shop/api/health > /dev/null 2>&1; then
  echo "  ✅ Public API healthy"
else
  echo "  ⚠️  Public API not reachable"
fi

# Validate DB has users (no hardcoded credentials)
DB_PATH="${DIR}/data/cruzercc.db"
if [ -f "$DB_PATH" ]; then
  USER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
  ADMIN_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE role='admin';" 2>/dev/null || echo "0")
  SELLER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE role='seller';" 2>/dev/null || echo "0")
  echo "  📊 DB: ${USER_COUNT} users (${ADMIN_COUNT} admin, ${SELLER_COUNT} seller)"
else
  echo "  ⚠️  Database not found at ${DB_PATH}"
fi

echo ""
echo "✅ Deploy complete!"
