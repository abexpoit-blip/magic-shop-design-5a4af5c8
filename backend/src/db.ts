import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "cruzercc.db");
export const db = new Database(DB_PATH);

// Performance settings
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

// Initialize schema
db.exec(`
  -- Users
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    username_lower TEXT GENERATED ALWAYS AS (lower(username)) STORED UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'buyer' CHECK(role IN ('buyer','seller','admin')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Profiles
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    country TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Wallets
  CREATE TABLE IF NOT EXISTS wallets (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Categories
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
  );

  -- Cards
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES categories(id),
    brand TEXT,
    bin TEXT,
    last4 TEXT,
    country TEXT,
    state TEXT,
    zip TEXT,
    level TEXT,
    type TEXT,
    bank TEXT,
    price REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'available',
    cc_data TEXT,
    cvv TEXT,
    exp_month INTEGER,
    exp_year INTEGER,
    holder_name TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sold_at TEXT
  );

  -- Add columns that may be missing on existing databases
  -- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we use a helper approach
`);

// Safely add missing columns to cards table
const addColIfMissing = (col: string, type: string) => {
  try {
    db.exec(`ALTER TABLE cards ADD COLUMN ${col} ${type}`);
  } catch {
    // column already exists — ignore
  }
};
addColIfMissing("city", "TEXT");
addColIfMissing("cc_number", "TEXT");
addColIfMissing("phone", "TEXT");
addColIfMissing("address", "TEXT");
addColIfMissing("base", "TEXT");
addColIfMissing("refundable", "INTEGER DEFAULT 0");
addColIfMissing("has_phone", "INTEGER DEFAULT 0");
addColIfMissing("has_email", "INTEGER DEFAULT 0");
addColIfMissing("email", "TEXT");

// Add snapshot columns to order_items so downloads work even if cards are deleted
const addOiCol = (col: string, type: string) => {
  try { db.exec(`ALTER TABLE order_items ADD COLUMN ${col} ${type}`); } catch { /* exists */ }
};
addOiCol("card_bin", "TEXT");
addOiCol("card_brand", "TEXT");
addOiCol("card_country", "TEXT");
addOiCol("card_last4", "TEXT");
addOiCol("card_city", "TEXT");
addOiCol("card_state", "TEXT");
addOiCol("card_zip", "TEXT");
addOiCol("card_base", "TEXT");
addOiCol("card_exp_month", "TEXT");
addOiCol("card_exp_year", "TEXT");
addOiCol("card_cc_number", "TEXT");
addOiCol("card_cvv", "TEXT");
addOiCol("card_holder_name", "TEXT");
addOiCol("card_address", "TEXT");
addOiCol("card_phone", "TEXT");
addOiCol("card_email", "TEXT");

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_cards_seller ON cards(seller_id);
  CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
  CREATE INDEX IF NOT EXISTS idx_cards_bin ON cards(bin);

  -- Orders
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    buyer_id TEXT NOT NULL REFERENCES users(id),
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES cards(id),
    seller_id TEXT NOT NULL REFERENCES users(id),
    price REAL NOT NULL
  );

  -- Transactions (wallet history)
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('deposit','purchase','refund','payout','adjustment')),
    amount REAL NOT NULL,
    ref_id TEXT,
    meta TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Deposits
  CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    proof_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    plisio_invoice_id TEXT,
    plisio_wallet TEXT,
    crypto_currency TEXT,
    crypto_amount REAL,
    txid TEXT,
    confirmations INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Payouts
  CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    destination TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Tickets
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ticket_messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Announcements
  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Site settings
  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '{}'
  );

  -- Cart
  CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, card_id)
  );

  -- Seller applications
  CREATE TABLE IF NOT EXISTS seller_applications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    reason TEXT,
    admin_notes TEXT,
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Refunds
  CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id TEXT REFERENCES orders(id),
    card_id TEXT REFERENCES cards(id),
    amount REAL NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    resolution_note TEXT,
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Deposit addresses (crypto)
  CREATE TABLE IF NOT EXISTS deposit_addresses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    method TEXT NOT NULL,
    address TEXT NOT NULL,
    label TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- News
  CREATE TABLE IF NOT EXISTS news (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'update',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Price rules (seller)
  CREATE TABLE IF NOT EXISTS price_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand TEXT,
    bin TEXT,
    country TEXT,
    price REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Patch: ensure 'type' column exists on news table (for upgrades) ──
try { db.exec(`ALTER TABLE news ADD COLUMN type TEXT NOT NULL DEFAULT 'update'`); console.log("✅ Added 'type' column to news"); } catch (_) { /* already exists */ }

// Schema initialization lives here; account seeding is handled explicitly by scripts/seed-admin.ts
console.log("✅ SQLite DB ready:", DB_PATH);
