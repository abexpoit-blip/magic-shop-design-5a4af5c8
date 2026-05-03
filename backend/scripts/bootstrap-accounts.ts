#!/usr/bin/env tsx
/**
 * Bootstrap admin+seller account.
 * Run on VPS: cd /path/to/backend && npx tsx scripts/bootstrap-accounts.ts
 */
import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

async function bootstrap() {
  const email = "admin@cruzercc";
  const username = "admin";
  const password = "Shovon@5448";

  const hash = await bcrypt.hash(password, 12);

  // Check if user exists
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

  let userId: string;

  if (existing.rows[0]) {
    userId = existing.rows[0].id;
    // Update password
    await pool.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [hash, userId]);
    console.log(`✅ Updated existing user: ${email} (${userId})`);
  } else {
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      [email, username, hash]
    );
    userId = rows[0].id;
    console.log(`✅ Created user: ${email} (${userId})`);

    // Create profile
    await pool.query(
      `INSERT INTO profiles (user_id, display_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, "Admin"]
    );

    // Create wallet
    await pool.query(
      `INSERT INTO wallets (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
      [userId]
    );
  }

  // Add admin role
  await pool.query(
    `INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING`,
    [userId]
  );
  console.log(`✅ Admin role assigned`);

  // Add seller role
  await pool.query(
    `INSERT INTO user_roles (user_id, role) VALUES ($1, 'seller') ON CONFLICT DO NOTHING`,
    [userId]
  );
  console.log(`✅ Seller role assigned`);

  // Add buyer role
  await pool.query(
    `INSERT INTO user_roles (user_id, role) VALUES ($1, 'buyer') ON CONFLICT DO NOTHING`,
    [userId]
  );
  console.log(`✅ Buyer role assigned`);

  console.log(`\n🎉 Done! Login with:`);
  console.log(`   Email/Username: admin@cruzercc / admin`);
  console.log(`   Password: Shovon@5448`);
  console.log(`   Admin login: https://cruzercc.shop/admin-login`);
  console.log(`   Buyer/Seller login: https://cruzercc.shop/auth`);
  console.log(`\n   This account has admin + seller + buyer roles.`);
  console.log(`   Use the role switcher in the app to switch between buyer/seller mode.`);

  await pool.end();
}

bootstrap().catch((e) => { console.error(e); process.exit(1); });
