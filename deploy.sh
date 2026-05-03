#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "⬇️  Pulling latest code..."
git pull origin main

echo "📦 Installing frontend dependencies..."
npm install

echo "🔨 Building frontend..."
npm run build

echo "📦 Installing backend dependencies..."
cd backend
npm install

echo "🔨 Building backend..."
npm run build

echo "♻️  Restarting backend..."
pm2 restart cruzercc-api

echo "✅ Deploy complete!"
