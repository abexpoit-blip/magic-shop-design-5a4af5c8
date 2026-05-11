#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$DIR"
FRONTEND_DIR="$APP_DIR/frontend"
BACKEND_DIR="$APP_DIR/backend"
DATA_DIR="$APP_DIR/data"
UPLOADS_DIR="$APP_DIR/uploads"
LOG_DIR="/var/log/cruzercc"
REPO_URL="https://github.com/abexpoit-blip/magic-shop-design.git"
BACKEND_ENV="$BACKEND_DIR/.env"

install_node_deps() {
  local target_dir="$1"
  if [ -f "$target_dir/package-lock.json" ]; then
    npm --prefix "$target_dir" ci --no-audit --no-fund
  else
    npm --prefix "$target_dir" install --no-audit --no-fund
  fi
}

ensure_backend_env() {
  if [ -f "$BACKEND_ENV" ]; then
    return
  fi

  mkdir -p "$BACKEND_DIR"
  JWT_SECRET="$(openssl rand -hex 32)"
  CARD_KEY="$(openssl rand -hex 32)"

  cat > "$BACKEND_ENV" <<EOF
PORT=8080
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://cruzercc.shop,https://www.cruzercc.shop
DATA_DIR=$DATA_DIR
BASE_URL=https://cruzercc.shop
CARD_ENCRYPTION_KEY=$CARD_KEY
UPLOAD_DIR=$UPLOADS_DIR
PUBLIC_UPLOAD_BASE=https://cruzercc.shop/uploads
ADMIN_EMAIL=admin@cruzercc.shop
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@2026!
EOF

  echo "✅ Created backend/.env"
}

write_nginx_config() {
  local backend_port="$1"

  if [ -f "/etc/letsencrypt/live/cruzercc.shop/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/cruzercc.shop/privkey.pem" ]; then
    sed "s|127.0.0.1:8080|127.0.0.1:${backend_port}|g" "$APP_DIR/nginx/cruzercc.conf" > /etc/nginx/sites-available/cruzercc
  else
    cat > /etc/nginx/sites-available/cruzercc <<EOF
server {
    listen 80;
    server_name cruzercc.shop www.cruzercc.shop;

    root $FRONTEND_DIR;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:${backend_port};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 25m;
    }

    location /uploads/ {
        alias $UPLOADS_DIR/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    location /assets/ {
        access_log off;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files \$uri =404;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires 0;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
  fi

  rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/cruzercc.shop /etc/nginx/sites-enabled/cruzercc.conf /etc/nginx/sites-enabled/cruzercc-api.conf
  ln -sf /etc/nginx/sites-available/cruzercc /etc/nginx/sites-enabled/cruzercc
  nginx -t
  systemctl reload nginx
}

mkdir -p "$FRONTEND_DIR" "$DATA_DIR" "$UPLOADS_DIR" "$LOG_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  rm -rf "$APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [ "${DEPLOY_SKIP_GIT_PULL:-0}" != "1" ]; then
  echo "⬇️  Syncing latest code..."
  git fetch origin main
  git reset --hard origin/main
fi

echo "🚀 Deploying cruzercc.shop..."
echo "🧾 Commit: $(git rev-parse --short HEAD)"

ensure_backend_env

echo "📦 Installing & building frontend..."
install_node_deps "$APP_DIR"
VITE_API_BASE=/api npm --prefix "$APP_DIR" run build
rm -rf "$FRONTEND_DIR"/*
cp -r "$APP_DIR/dist"/* "$FRONTEND_DIR"/

echo "📦 Installing & building backend..."
install_node_deps "$BACKEND_DIR"
npm --prefix "$BACKEND_DIR" run build

echo "🗄️  Running migrations..."
npm --prefix "$BACKEND_DIR" run migrate

echo "👤 Seeding base accounts..."
npm --prefix "$BACKEND_DIR" run seed-admin || echo "⚠️  Seed warnings (non-fatal)"

echo "♻️  Restarting backend..."
if pm2 describe cruzercc-api > /dev/null 2>&1; then
  pm2 delete cruzercc-api
fi
pm2 start "$BACKEND_DIR/ecosystem.config.cjs" --only cruzercc-api --update-env
pm2 save

BACKEND_PORT=$(grep -oP '^PORT=\K\d+' "$BACKEND_ENV" 2>/dev/null || echo "8080")

echo "🌐 Updating nginx..."
write_nginx_config "$BACKEND_PORT"

echo "🔍 Health checks..."
ok=false
for i in $(seq 1 20); do
  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/health" | grep -q '"ok":true'; then
    echo "  ✅ Local API healthy"
    ok=true
    break
  fi
  sleep 2
done

if [ "$ok" = false ]; then
  echo "  ❌ Local API health check FAILED"
  pm2 logs cruzercc-api --lines 30 --nostream || true
  exit 1
fi

if curl -sf https://cruzercc.shop/api/health | grep -q '"ok":true' 2>/dev/null; then
  echo "  ✅ Public API healthy"
else
  echo "  ⚠️  Public API not reachable yet"
fi

DB_PATH="$DATA_DIR/cruzercc.db"
if [ -f "$DB_PATH" ] && command -v sqlite3 > /dev/null 2>&1; then
  USER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
  ADMIN_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE role='admin';" 2>/dev/null || echo "0")
  SELLER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE role='seller';" 2>/dev/null || echo "0")
  echo "  📊 DB: ${USER_COUNT} users (${ADMIN_COUNT} admin, ${SELLER_COUNT} seller)"
fi

echo "✅ Deploy complete!"
