import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db.js";
import { signToken, requireAuth } from "../auth-middleware.js";

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email().max(255),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid username"),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  identifier: z.string().min(1).max(255),
  password: z.string().min(1).max(128),
});

// Generate a random hex ID
function genId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Buyer signup ──
authRouter.post("/signup", async (req, res, next) => {
  try {
    const { email, username, password } = signupSchema.parse(req.body);
    const hash = await bcrypt.hash(password, 12);
    const id = genId();

    // Check duplicates
    const dup = db.prepare(
      `SELECT 1 FROM users WHERE lower(email) = lower(?) OR username_lower = lower(?) LIMIT 1`
    ).get(email, username);
    if (dup) return res.status(409).json({ error: "Email or username already in use" });

    const insert = db.transaction(() => {
      db.prepare(
        `INSERT INTO users (id, email, username, password_hash, role) VALUES (?, ?, ?, ?, 'buyer')`
      ).run(id, email.toLowerCase(), username, hash);
      db.prepare(`INSERT INTO profiles (user_id) VALUES (?)`).run(id);
      db.prepare(`INSERT INTO wallets (user_id) VALUES (?)`).run(id);
    });
    insert();

    const token = signToken({ sub: id, email: email.toLowerCase(), username, role: "buyer" });
    res.json({ token, user: { id, email: email.toLowerCase(), username, role: "buyer" } });
  } catch (e) { next(e); }
});

// ── Generic login (returns role) ──
function loginCore(identifier: string, password: string) {
  const row = db.prepare(
    `SELECT id, email, username, password_hash, role, is_active
       FROM users
      WHERE lower(email) = lower(?) OR username_lower = lower(?)
      LIMIT 1`
  ).get(identifier, identifier) as any;

  if (!row || !row.is_active) return null;
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return null;

  const token = signToken({ sub: row.id, email: row.email, username: row.username, role: row.role });
  return { token, user: { id: row.id, email: row.email, username: row.username, role: row.role } };
}

// ── Buyer login ──
authRouter.post("/login", (req, res, next) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);
    const result = loginCore(identifier, password);
    if (!result) return res.status(401).json({ error: "Invalid credentials" });
    // Buyers and sellers can both use this endpoint
    if (result.user.role === "admin") return res.status(403).json({ error: "Use admin login" });
    res.json(result);
  } catch (e) { next(e); }
});

// ── Seller login ──
authRouter.post("/seller-login", (req, res, next) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);
    const result = loginCore(identifier, password);
    if (!result) return res.status(401).json({ error: "Invalid credentials" });
    if (result.user.role !== "seller" && result.user.role !== "admin") {
      return res.status(403).json({ error: "Not a seller account" });
    }
    res.json(result);
  } catch (e) { next(e); }
});

// ── Admin login ──
authRouter.post("/admin-login", (req, res, next) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);
    const result = loginCore(identifier, password);
    if (!result) return res.status(401).json({ error: "Invalid credentials" });
    if (result.user.role !== "admin") return res.status(403).json({ error: "Not an admin" });
    res.json(result);
  } catch (e) { next(e); }
});

// ── Get current user ──
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ── Change password ──
authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const { password } = z.object({ password: z.string().min(8).max(128) }).parse(req.body);
    const hash = await bcrypt.hash(password, 12);
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, req.user!.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
