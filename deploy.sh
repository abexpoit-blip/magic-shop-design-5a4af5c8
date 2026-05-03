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
cp $APP/nginx/cruzercc.conf /etc/nginx/sites-available/cruzercc.conf
ln -sf /etc/nginx/sites-available/cruzercc.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

sleep 2
curl -sf http://127.0.0.1:8080/api/health && echo "✅ API healthy" || echo "⚠️ API not responding"
echo "✅ Deploy complete!"
