import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const adminRouter = Router();

// All admin routes require admin role
adminRouter.use(requireAuth, requireRole("admin"));

// ── List users ──
adminRouter.get("/users", (req, res) => {
  const q = (req.query.q as string || "").trim();
  let rows;
  if (q) {
    rows = db.prepare(`
      SELECT u.id, u.email, u.username, u.role, u.is_active, u.created_at,
             w.balance,
             (u.role = 'seller') as is_seller,
             (u.is_active = 0) as banned
        FROM users u
        LEFT JOIN wallets w ON w.user_id = u.id
       WHERE lower(u.username) LIKE ? OR lower(u.email) LIKE ?
       ORDER BY u.created_at DESC
    `).all(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
  } else {
    rows = db.prepare(`
      SELECT u.id, u.email, u.username, u.role, u.is_active, u.created_at,
             w.balance,
             (u.role = 'seller') as is_seller,
             (u.is_active = 0) as banned
        FROM users u
        LEFT JOIN wallets w ON w.user_id = u.id
       ORDER BY u.created_at DESC
    `).all();
  }
  res.json({ users: rows });
});

// ── Dashboard stats ──
adminRouter.get("/stats", (_req, res) => {
  const totalUsers = (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as any).c;
  const totalSellers = (db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'seller'`).get() as any).c;
  const pendingDeposits = (db.prepare(`SELECT COUNT(*) as c FROM deposits WHERE status = 'pending'`).get() as any).c;
  const pendingPayouts = (db.prepare(`SELECT COUNT(*) as c FROM payouts WHERE status = 'pending'`).get() as any).c;
  const pendingApps = (db.prepare(`SELECT COUNT(*) as c FROM seller_applications WHERE status = 'pending'`).get() as any).c;
  const cardsAvailable = (db.prepare(`SELECT COUNT(*) as c FROM cards WHERE status = 'available'`).get() as any).c;
  const cardsSold = (db.prepare(`SELECT COUNT(*) as c FROM cards WHERE status = 'sold'`).get() as any).c;
  res.json({ totalUsers, totalSellers, pendingDeposits, pendingPayouts, pendingApps, cardsAvailable, cardsSold });
});

// ── Toggle ban (activate/deactivate) ──
adminRouter.post("/users/:id/toggle-ban", (req, res) => {
  const user = db.prepare(`SELECT id, is_active FROM users WHERE id = ?`).get(req.params.id) as any;
  if (!user) return res.status(404).json({ error: "User not found" });
  const newActive = user.is_active ? 0 : 1;
  db.prepare(`UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?`).run(newActive, req.params.id);
  res.json({ ok: true, is_active: !!newActive });
});

// ── Adjust balance ──
adminRouter.post("/users/:id/balance", (req, res) => {
  const { delta } = req.body;
  if (typeof delta !== "number") return res.status(400).json({ error: "delta must be a number" });

  const wallet = db.prepare(`SELECT balance FROM wallets WHERE user_id = ?`).get(req.params.id) as any;
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });

  const newBalance = Number(wallet.balance) + delta;
  if (newBalance < 0) return res.status(400).json({ error: "Balance cannot go negative" });

  db.transaction(() => {
    db.prepare(`UPDATE wallets SET balance = ?, updated_at = datetime('now') WHERE user_id = ?`).run(newBalance, req.params.id);
    db.prepare(`INSERT INTO transactions (user_id, type, amount, meta) VALUES (?, 'adjustment', ?, ?)`).run(
      req.params.id, delta, JSON.stringify({ by: req.user!.id, note: "admin adjustment" })
    );
  })();

  res.json({ ok: true, balance: newBalance });
});

// ── Revoke seller → back to buyer ──
adminRouter.post("/users/:id/revoke-seller", (req, res) => {
  const user = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(req.params.id) as any;
  if (!user) return res.status(404).json({ error: "User not found" });
  db.prepare(`UPDATE users SET role = 'buyer', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ── Approve seller (promote buyer → seller) ──
adminRouter.post("/users/:id/make-seller", (req, res) => {
  const user = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(req.params.id) as any;
  if (!user) return res.status(404).json({ error: "User not found" });
  db.prepare(`UPDATE users SET role = 'seller', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ── Change admin password ──
adminRouter.post("/change-password", async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash(password, 12);
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, req.user!.id);
  res.json({ ok: true });
});
