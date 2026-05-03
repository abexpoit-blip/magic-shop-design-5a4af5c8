#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# CRUZERCC VPS SETUP — Run this ON YOUR VPS as root
# One command: curl -sL <url> | bash   OR   bash vps-setup.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/var/www/cruzercc"
REPO_URL="https://github.com/abexpoit-blip/magic-shop-design.git"
DB_NAME="cruzercc"
DB_USER="cruzercc"
DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
JWT_SECRET=$(openssl rand -hex 32)
CARD_KEY=$(openssl rand -hex 32)

echo "══════════════════════════════════════════"
echo "  CRUZERCC.SHOP — Full VPS Setup"
echo "══════════════════════════════════════════"

# ── 1. Install dependencies ──
echo "→ [1/8] Installing system packages…"
apt-get update -qq
apt-get install -y -qq curl git nginx postgresql postgresql-contrib

# Install Node.js 20 if not present
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 18 ]]; then
  echo "→ Installing Node.js 20…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

# Install PM2 globally
npm install -g pm2 tsx 2>/dev/null || true

if ss -ltn '( sport = :8080 )' | tail -n +2 | grep -q .; then
  echo "→ Port 8080 is already in use; cruzercc will use 18080 instead…"
  APP_PORT=18080
else
  APP_PORT=8080
fi

# ── 2. Setup PostgreSQL ──
echo "→ [2/8] Setting up database…"
# Start postgres if not running
systemctl enable postgresql
systemctl start postgresql

# Create DB user and database (skip if exists)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

DATABASE_URL="postgres://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME"
echo "   DB: $DB_NAME / user: $DB_USER"

# ── 3. Clone repo ──
echo "→ [3/8] Cloning repository…"
mkdir -p "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull origin main
else
  git clone "$REPO_URL" "$APP_DIR"
fi

# ── 4. Run SQL schema ──
echo "→ [4/8] Running database migrations…"
cd "$APP_DIR"
for f in backend/sql/*.sql; do
  echo "   Running $f…"
  PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -f "$f" 2>/dev/null || true
done

# ── 5. Setup backend ──
echo "→ [5/8] Setting up backend…"
cd "$APP_DIR/backend"
npm install

# Create .env if it doesn't exist
if [ ! -f .env ]; then
cat > .env << ENVEOF
PORT=$APP_PORT
NODE_ENV=production
DATABASE_URL=$DATABASE_URL
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
CARD_ENCRYPTION_KEY=$CARD_KEY
UPLOAD_DIR=$APP_DIR/uploads
PUBLIC_UPLOAD_BASE=https://cruzercc.shop/uploads
CORS_ORIGIN=https://cruzercc.shop,https://www.cruzercc.shop
ADMIN_EMAIL=admin@cruzercc
ADMIN_PASSWORD=Shovon@5448
ADMIN_USERNAME=admin
ENVEOF
echo "   ✅ .env created"
else
echo "   .env already exists — skipping"
fi

# Build TypeScript
npm run build

# ── 6. Create admin account ──
echo "→ [6/8] Bootstrapping admin account…"
mkdir -p "$APP_DIR/uploads"
mkdir -p /var/log/cruzercc
npx tsx scripts/bootstrap-accounts.ts 2>/dev/null || echo "   (bootstrap script may need adjustment)"

# ── 7. Setup nginx ──
echo "→ [7/8] Configuring nginx…"

# Check if cruzercc nginx config already exists
if [ ! -f /etc/nginx/sites-available/cruzercc ]; then
cat > /etc/nginx/sites-available/cruzercc << 'NGINXEOF'
server {
    listen 80;
    server_name cruzercc.shop www.cruzercc.shop;

    root /var/www/cruzercc/frontend;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 25m;
    }

    # Uploads
    location /uploads/ {
        alias /var/www/cruzercc/uploads/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }
}
NGINXEOF
rm -f /etc/nginx/sites-enabled/cruzercc.shop /etc/nginx/sites-available/cruzercc.shop 2>/dev/null || true
ln -sf /etc/nginx/sites-available/cruzercc /etc/nginx/sites-enabled/
echo "   ✅ Nginx config created"
else
echo "   Nginx config already exists — skipping"
fi

nginx -t && systemctl reload nginx

# ── 8. Start backend with PM2 ──
echo "→ [8/8] Starting backend…"
cd "$APP_DIR/backend"
pm2 delete cruzercc-api 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# ── 9. Build & deploy frontend ──
echo "→ [BONUS] Building frontend…"
cd "$APP_DIR"
npm install
VITE_API_BASE=/api npx vite build --outDir frontend 2>/dev/null || {
  echo "   Frontend build needs VITE env — building with defaults…"
  VITE_API_BASE=/api VITE_SUPABASE_URL=https://unused.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=unused npx vite build --outDir frontend
}

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ SETUP COMPLETE!"
echo "══════════════════════════════════════════"
echo ""
echo "  🌐 Site:    https://cruzercc.shop"
echo "  🔌 API:     https://cruzercc.shop/api/health"
echo ""
echo "  👤 Admin Login:  https://cruzercc.shop/admin-login"
echo "  🛒 Buyer Login:  https://cruzercc.shop/auth"
echo ""
echo "  📧 Email:    admin@cruzercc"
echo "  🔑 Password: Shovon@5448"
echo "  🎭 Roles:    admin + seller + buyer"
echo ""
echo "  📝 DB Password saved in: $APP_DIR/backend/.env"
echo ""
echo "  ⚠️  Next: Setup SSL with:"
echo "     apt install certbot python3-certbot-nginx"
echo "     certbot --nginx -d cruzercc.shop -d www.cruzercc.shop"
echo "══════════════════════════════════════════"
