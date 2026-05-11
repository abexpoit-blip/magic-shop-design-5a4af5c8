# cruzercc backend — Delivery 1

Self-hosted Node/Express + Postgres backend deployed to **161.97.100.218** via GitHub Actions.

## One-time VPS setup

Run these as root on the VPS, ONCE:

```bash
# 1. Install Node 20 + Postgres 16 + PM2 + nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs postgresql postgresql-contrib nginx git
npm i -g pm2

# 2. Create database + user
sudo -u postgres psql <<'SQL'
CREATE USER cruzercc WITH PASSWORD 'STRONG_PASSWORD';
CREATE DATABASE cruzercc OWNER cruzercc;
SQL

# 3. Clone repo (one time)
mkdir -p /var/www && cd /var/www
git clone https://github.com/abexpoit-blip/magic-shop-design.git cruzercc
cd cruzercc

# 4. Configure backend env
cp backend/.env.example backend/.env
nano backend/.env     # fill DATABASE_URL, JWT_SECRET, CARD_ENCRYPTION_KEY (openssl rand -hex 32)

# 5. First install + migrate + bootstrap admin
cd backend
npm ci
npm run build
npm run migrate
npm run bootstrap-admin

# 6. Start with PM2
mkdir -p /var/log/cruzercc
pm2 delete cruzercc-api 2>/dev/null || true
pm2 start ecosystem.config.cjs --only cruzercc-api --update-env
pm2 save
pm2 startup    # follow the printed instruction

# 7. Build frontend into /var/www/cruzercc/frontend
cd /var/www/cruzercc
npm ci
VITE_API_BASE=/api npm run build
mkdir -p /var/www/cruzercc/frontend
rm -rf /var/www/cruzercc/frontend/*
cp -r dist/* /var/www/cruzercc/frontend/

# 8. Nginx — site root must be /var/www/cruzercc/frontend, API proxy must go to 127.0.0.1:8080
nginx -t && systemctl reload nginx

# 9. Uploads dir
mkdir -p /var/www/cruzercc/uploads && chown -R www-data:www-data /var/www/cruzercc/uploads
```

## GitHub secrets required (Settings → Secrets → Actions)

- `VPS_HOST` = `161.97.100.218`
- `VPS_USER` = `root` (or your deploy user)
- `VPS_SSH_KEY` = the **private** key matching a public key in `~/.ssh/authorized_keys` on the VPS
- `VPS_PORT` = `22`

After those are set, every push to `main` that touches `backend/**` auto-deploys.

## Production paths

- Frontend root: `/var/www/cruzercc/frontend`
- Backend app dir: `/var/www/cruzercc/backend`
- Backend entry: `/var/www/cruzercc/backend/dist/server.js`
- Admin login: `https://cruzercc.shop/admin-login`

## Verify

```bash
curl https://cruzercc.shop/api/health
curl -X POST https://cruzercc.shop/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"samexpoit@gmail.com","password":"Shovon@5448"}'
```

You should get `{ token, user: { roles: ["admin"] } }`.
