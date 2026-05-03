#!/usr/bin/env node
/**
 * Bootstrap admin+seller account.
 * Run on VPS:  cd /var/www/cruzercc/backend && node scripts/bootstrap-accounts.mjs
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

  // Reuse an existing account by email OR case-insensitive username to avoid
  // colliding with the generated unique username_ci column.
  const existing = await pool.query(
    "SELECT id, email, username FROM users WHERE lower(email) = lower($1) OR username_ci = lower($2) ORDER BY CASE WHEN lower(email) = lower($1) THEN 0 ELSE 1 END LIMIT 1",
    [email, username]
  );

  let userId;

  if (existing.rows[0]) {
    userId = existing.rows[0].id;
    await pool.query(
      "UPDATE users SET email = $1, password_hash = $2, is_active = true, updated_at = now() WHERE id = $3",
      [email.toLowerCase(), hash, userId]
    );
    console.log(`✅ Updated existing user: ${existing.rows[0].email} / ${existing.rows[0].username} (${userId})`);

    await pool.query(
      `INSERT INTO profiles (user_id, display_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, "Admin"]
    );
    await pool.query(
      `INSERT INTO wallets (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
      [userId]
    );
  } else {
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash, is_active)
       VALUES ($1, $2, $3, true) RETURNING id`,
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

  // Add roles
  for (const role of ["admin", "seller", "buyer"]) {
    await pool.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, role]
    );
    console.log(`✅ ${role} role assigned`);
  }

  console.log(`\n🎉 Done! Login with:`);
  console.log(`   Email/Username: admin@cruzercc / admin`);
  console.log(`   Password: Shovon@5448`);
  console.log(`   Admin login: https://cruzercc.shop/admin-login`);
  console.log(`   Buyer/Seller login: https://cruzercc.shop/auth`);

  await pool.end();
}

bootstrap().catch((e) => { console.error(e); process.exit(1); });
