-- Tables for site-settings extras, refunds, news, price-rules, deposit-addresses

-- ---- news / updates ----
CREATE TABLE IF NOT EXISTS news_updates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---- refund requests ----
DO $$ BEGIN
  CREATE TYPE refund_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS refunds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id        uuid REFERENCES orders(id),
  card_id         uuid REFERENCES cards(id),
  amount          numeric(12,2) NOT NULL,
  reason          text,
  status          refund_status NOT NULL DEFAULT 'pending',
  resolution_note text,
  reviewed_by     uuid REFERENCES users(id),
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refunds_buyer_idx ON refunds(buyer_id);
CREATE INDEX IF NOT EXISTS refunds_status_idx ON refunds(status);

-- ---- price rules (seller auto-pricing) ----
CREATE TABLE IF NOT EXISTS price_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country    text,
  brand      text,
  base       text,
  level      text,
  price      numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_rules_seller_idx ON price_rules(seller_id);

-- ---- deposit addresses (crypto wallets shown to buyers) ----
CREATE TABLE IF NOT EXISTS deposit_addresses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method     text NOT NULL,
  address    text NOT NULL,
  label      text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
