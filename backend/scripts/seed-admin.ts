/**
 * Seed script — creates admin, seller, and buyer test accounts.
 * Idempotent: safe to run multiple times.
 *
 * Usage:  npx tsx scripts/seed-admin.ts
 */
import "dotenv/config";
import "../src/db.js";
import { db } from "../src/db.js";
import bcrypt from "bcryptjs";

function genId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

interface SeedUser {
  email: string;
  username: string;
  password: string;
  role: "admin" | "seller" | "buyer";
  balance: number;
}

const users: SeedUser[] = [
  {
    email: "admin@cruzercc.shop",
    username: "admin",
    password: "Admin@2026!",
    role: "admin",
    balance: 0,
  },
  {
    email: "seller@cruzercc.shop",
    username: "seller1",
    password: "Seller@2026!",
    role: "seller",
    balance: 500,
  },
  {
    email: "buyer@cruzercc.shop",
    username: "buyer1",
    password: "Buyer@2026!",
    role: "buyer",
    balance: 100,
  },
];

for (const u of users) {
  const hash = bcrypt.hashSync(u.password, 12);
  const existing = db.prepare(
    `SELECT id FROM users
      WHERE lower(email) = lower(?) OR username_lower = lower(?)
      ORDER BY CASE WHEN lower(email) = lower(?) THEN 0 ELSE 1 END
      LIMIT 1`
  ).get(u.email, u.username, u.email) as any;

  if (existing) {
    db.transaction(() => {
      db.prepare(
        `UPDATE users
            SET email = ?,
                username = ?,
                password_hash = ?,
                role = ?,
                is_active = 1,
                updated_at = datetime('now')
          WHERE id = ?`
      ).run(u.email.toLowerCase(), u.username, hash, u.role, existing.id);
      db.prepare(`INSERT OR IGNORE INTO profiles (user_id) VALUES (?)`).run(existing.id);
      db.prepare(`INSERT OR IGNORE INTO wallets (user_id, balance) VALUES (?, ?)`).run(existing.id, u.balance);
      db.prepare(
        `UPDATE wallets SET balance = CASE WHEN balance = 0 THEN ? ELSE balance END, updated_at = datetime('now') WHERE user_id = ?`
      ).run(u.balance, existing.id);
    })();
    console.log(`✅ ${u.role.toUpperCase()} updated: ${u.email} / ${u.username} / ${u.password}`);
  } else {
    const id = genId();
    db.transaction(() => {
      db.prepare(
        `INSERT INTO users (id, email, username, password_hash, role) VALUES (?, ?, ?, ?, ?)`
      ).run(id, u.email.toLowerCase(), u.username, hash, u.role);
      db.prepare(`INSERT INTO profiles (user_id) VALUES (?)`).run(id);
      db.prepare(`INSERT INTO wallets (user_id, balance) VALUES (?, ?)`).run(id, u.balance);
    })();
    console.log(`✅ ${u.role.toUpperCase()} created: ${u.email} / ${u.username} / ${u.password}`);
  }
}

console.log(`
╔══════════════════════════════════════════════╗
║          TEST ACCOUNT CREDENTIALS            ║
╠══════════════════════════════════════════════╣
║  ADMIN  │ admin@cruzercc.shop / Admin@2026!  ║
║  Login  │ /admin-login                       ║
╠══════════════════════════════════════════════╣
║  SELLER │ seller@cruzercc.shop / Seller@2026!║
║  Login  │ /seller-login                      ║
╠══════════════════════════════════════════════╣
║  BUYER  │ buyer@cruzercc.shop / Buyer@2026!  ║
║  Login  │ /auth                              ║
╚══════════════════════════════════════════════╝
`);

process.exit(0);
