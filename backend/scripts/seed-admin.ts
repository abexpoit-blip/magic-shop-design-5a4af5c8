import "../src/db.js";
import { db } from "../src/db.js";
import bcrypt from "bcryptjs";

const email = process.env.ADMIN_EMAIL || "admin@cruzercc.shop";
const username = process.env.ADMIN_USER || "admin";
const password = process.env.ADMIN_PASS || "Admin@2026!";

const hash = bcrypt.hashSync(password, 12);

const existing = db.prepare(`SELECT id FROM users WHERE lower(email) = lower(?)`).get(email) as any;
if (existing) {
  db.prepare(`UPDATE users SET password_hash = ?, role = 'admin', updated_at = datetime('now') WHERE id = ?`).run(hash, existing.id);
  console.log(`✅ Admin updated: ${email}`);
} else {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  db.transaction(() => {
    db.prepare(`INSERT INTO users (id, email, username, password_hash, role) VALUES (?, ?, ?, ?, 'admin')`).run(id, email, username, hash);
    db.prepare(`INSERT INTO profiles (user_id) VALUES (?)`).run(id);
    db.prepare(`INSERT INTO wallets (user_id) VALUES (?)`).run(id);
  })();
  console.log(`✅ Admin created: ${email} / ${username}`);
}

process.exit(0);
