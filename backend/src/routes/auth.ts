import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db.js";
import { signToken, requireAuth } from "../auth-middleware.js";

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid username"),
  password: z.string().min(8).max(128),
});

// Self-signup → always 'buyer'. Sellers must apply + be approved by admin.
authRouter.post("/signup", async (req, res, next) => {
  try {
    const { email, username, password } = signupSchema.parse(req.body);
    const hash = await bcrypt.hash(password, 12);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const dup = await client.query(
        `SELECT 1 FROM users WHERE lower(email)=lower($1) OR username_ci=lower($2) LIMIT 1`,
        [email, username]
      );
      if (dup.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Email or username already in use" });
      }
      const u = await client.query(
        `INSERT INTO users (email, username, password_hash) VALUES ($1,$2,$3) RETURNING id, email, username`,
        [email.toLowerCase(), username, hash]
      );
      const userId = u.rows[0].id;
      await client.query(`INSERT INTO profiles (user_id) VALUES ($1)`, [userId]);
      await client.query(`INSERT INTO wallets (user_id) VALUES ($1)`, [userId]);
      await client.query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1,'buyer') ON CONFLICT DO NOTHING`,
        [userId]
      );
      await client.query("COMMIT");
      const token = signToken({ sub: userId, email: u.rows[0].email, username: u.rows[0].username });
      res.json({ token, user: { id: userId, email: u.rows[0].email, username: u.rows[0].username, roles: ["buyer"] } });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) { next(e); }
});

const loginSchema = z.object({
  identifier: z.string().min(1), // email or username (case-insensitive)
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

async function loginCore(identifier: string, password: string) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.username, u.password_hash, u.is_active,
            COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles r ON r.user_id = u.id
      WHERE lower(u.email) = lower($1) OR u.username_ci = lower($1)
      GROUP BY u.id LIMIT 1`,
    [identifier]
  );
  const u = rows[0];
  if (!u || !u.is_active) return null;
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return null;
  const token = signToken({ sub: u.id, email: u.email, username: u.username });
  return { token, user: { id: u.id, email: u.email, username: u.username, roles: u.roles } };
}

authRouter.post("/login", async (req, res, next) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);
    const result = await loginCore(identifier, password);
    if (!result) return res.status(401).json({ error: "Invalid credentials" });
    res.json(result);
  } catch (e) { next(e); }
});

// Admin-only login endpoint — same logic, but rejects non-admins.
authRouter.post("/admin-login", async (req, res, next) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);
    const result = await loginCore(identifier, password);
    if (!result) return res.status(401).json({ error: "Invalid credentials" });
    if (!result.user.roles.includes("admin")) return res.status(403).json({ error: "Not an admin" });
    res.json(result);
  } catch (e) { next(e); }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const { password } = changePasswordSchema.parse(req.body);
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`,
      [req.user!.id, hash],
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
