import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../src/db.js";

async function run() {
  const email = process.env.ADMIN_EMAIL!;
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD!;
  if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD required");

  const hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, [email]);
    let userId: string;
    if (existing.rowCount) {
      userId = existing.rows[0].id;
      await client.query(`UPDATE users SET password_hash=$2, username=$3 WHERE id=$1`, [userId, hash, username]);
      console.log(`↻ Updated existing admin ${email}`);
    } else {
      const u = await client.query(
        `INSERT INTO users (email, username, password_hash) VALUES ($1,$2,$3) RETURNING id`,
        [email.toLowerCase(), username, hash]
      );
      userId = u.rows[0].id;
      await client.query(`INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
      await client.query(`INSERT INTO wallets  (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
      console.log(`✅ Created admin ${email}`);
    }
    await client.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1,'admin') ON CONFLICT DO NOTHING`,
      [userId]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(e => { console.error(e); process.exit(1); });
