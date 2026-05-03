#!/bin/bash
set -e

APP=/var/www/cruzercc
echo "🚀 Deploying cruzercc.shop..."

cd $APP
git fetch origin main
git reset --hard origin/main

# Frontend
echo "📦 Building frontend..."
npm ci
VITE_API_BASE=/api npm run build
mkdir -p $APP/frontend
rm -rf $APP/frontend/*
cp -r dist/* $APP/frontend/

# Backend
echo "📦 Building backend..."
cd $APP/backend
npm ci
npm run build

# Seed admin if fresh DB
if [ ! -f $APP/data/cruzercc.db ]; then
  echo "🌱 Seeding admin..."
  npx tsx scripts/seed-admin.ts
fi

# Restart API
echo "♻️ Restarting API..."
pm2 reload cruzercc-api --update-env 2>/dev/null || pm2 start $APP/backend/ecosystem.config.cjs
pm2 save

# Nginx
echo "🔄 Reloading nginx..."
cp $APP/nginx/cruzercc.conf /etc/nginx/sites-available/cruzercc.conf
ln -sf /etc/nginx/sites-available/cruzercc.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

sleep 2
curl -sf http://127.0.0.1:8080/api/health && echo "✅ API healthy" || echo "⚠️ API not responding"
echo "✅ Deploy complete!"
