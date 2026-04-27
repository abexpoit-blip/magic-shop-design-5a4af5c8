-- ============================================================
-- cruzercc initial schema (Postgres) — mirrors prior Supabase
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---- enums ----
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin','seller','buyer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE seller_app_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending','paid','refunded','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tx_type AS ENUM ('deposit','purchase','refund','payout','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- users ----
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  username      citext_or_text_unused text,
  username_ci   text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- We use a lowercased copy column for case-insensitive uniqueness
-- (avoids requiring the citext extension on minimal Postgres installs).
ALTER TABLE users DROP COLUMN IF EXISTS username;
ALTER TABLE users DROP COLUMN IF EXISTS username_ci CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_ci text GENERATED ALWAYS AS (lower(username)) STORED;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_username_ci_key UNIQUE (username_ci);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- profiles ----
CREATE TABLE IF NOT EXISTS profiles (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url   text,
  bio          text,
  country      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---- roles ----
CREATE TABLE IF NOT EXISTS user_roles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    app_role NOT NULL,
  UNIQUE (user_id, role)
);
CREATE INDEX IF NOT EXISTS user_roles_user_idx ON user_roles(user_id);

-- ---- wallets ----
CREATE TABLE IF NOT EXISTS wallets (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance    numeric(14,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---- seller applications ----
CREATE TABLE IF NOT EXISTS seller_applications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      seller_app_status NOT NULL DEFAULT 'pending',
  reason      text,
  admin_notes text,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seller_apps_user_idx ON seller_applications(user_id);
CREATE INDEX IF NOT EXISTS seller_apps_status_idx ON seller_applications(status);

-- ---- categories ----
CREATE TABLE IF NOT EXISTS categories (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL
);

-- ---- cards (sensitive PII encrypted at rest) ----
CREATE TABLE IF NOT EXISTS cards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id   uuid REFERENCES categories(id),
  brand         text,
  bin           text,
  last4         text,
  country       text,
  state         text,
  zip           text,
  level         text,
  type          text,
  bank          text,
  price         numeric(10,2) NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'available',
  cc_number_enc text,
  cvv_enc       text,
  exp_month     int,
  exp_year      int,
  holder_name   text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sold_at       timestamptz
);
CREATE INDEX IF NOT EXISTS cards_seller_idx ON cards(seller_id);
CREATE INDEX IF NOT EXISTS cards_status_idx ON cards(status);
CREATE INDEX IF NOT EXISTS cards_bin_idx ON cards(bin);

-- ---- orders ----
CREATE TABLE IF NOT EXISTS orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id    uuid NOT NULL REFERENCES users(id),
  total       numeric(12,2) NOT NULL DEFAULT 0,
  status      order_status NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_buyer_idx ON orders(buyer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id  uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  card_id   uuid NOT NULL REFERENCES cards(id),
  seller_id uuid NOT NULL REFERENCES users(id),
  price     numeric(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

-- ---- transactions ----
CREATE TABLE IF NOT EXISTS transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       tx_type NOT NULL,
  amount     numeric(12,2) NOT NULL,
  ref_id     uuid,
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tx_user_idx ON transactions(user_id);

-- ---- deposits ----
CREATE TABLE IF NOT EXISTS deposits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       numeric(12,2) NOT NULL,
  method       text NOT NULL,
  proof_url    text,
  status       text NOT NULL DEFAULT 'pending',
  admin_notes  text,
  reviewed_by  uuid REFERENCES users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deposits_user_idx ON deposits(user_id);
CREATE INDEX IF NOT EXISTS deposits_status_idx ON deposits(status);

-- ---- payouts ----
CREATE TABLE IF NOT EXISTS payouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      numeric(12,2) NOT NULL,
  method      text NOT NULL,
  destination text,
  status      text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payouts_seller_idx ON payouts(seller_id);

-- ---- tickets ----
CREATE TABLE IF NOT EXISTS tickets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject    text NOT NULL,
  status     text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES users(id),
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---- announcements / settings ----
CREATE TABLE IF NOT EXISTS announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

-- ---- audit log ----
CREATE TABLE IF NOT EXISTS audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   uuid REFERENCES users(id),
  action     text NOT NULL,
  target     text,
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
