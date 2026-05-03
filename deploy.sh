#!/bin/bash
set -e

APP=/var/www/cruzercc
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

# Nginx
echo "🔄 Reloading nginx..."
cp $APP/nginx/cruzercc.conf /etc/nginx/sites-available/cruzercc
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/cruzercc /etc/nginx/sites-enabled/cruzercc.conf /etc/nginx/sites-enabled/cruzercc-api.conf
ln -sf /etc/nginx/sites-available/cruzercc /etc/nginx/sites-enabled/cruzercc
nginx -t && systemctl reload nginx

for url in http://127.0.0.1:8080/api/health https://cruzercc.shop/api/health; do
  ok=false
  for i in $(seq 1 15); do
    if curl -fsS "$url" >/dev/null; then
      echo "✅ Healthy: $url"
      ok=true
      break
    fi
    sleep 2
  done
  if [ "$ok" = false ]; then
    echo "❌ Health check failed: $url"
    exit 1
  fi
done
echo "✅ Deploy complete!"
