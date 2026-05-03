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

// ── Extended dashboard stats ──
adminRouter.get("/stats", (_req, res) => {
  const totalUsers = (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as any).c;
  const totalSellers = (db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'seller'`).get() as any).c;
  const totalBuyers = (db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'buyer'`).get() as any).c;
  const pendingDeposits = (db.prepare(`SELECT COUNT(*) as c FROM deposits WHERE status = 'pending'`).get() as any).c;
  const pendingPayouts = (db.prepare(`SELECT COUNT(*) as c FROM payouts WHERE status = 'pending'`).get() as any).c;
  const pendingApps = (db.prepare(`SELECT COUNT(*) as c FROM seller_applications WHERE status = 'pending'`).get() as any).c;
  const cardsAvailable = (db.prepare(`SELECT COUNT(*) as c FROM cards WHERE status = 'available'`).get() as any).c;
  const cardsSold = (db.prepare(`SELECT COUNT(*) as c FROM cards WHERE status = 'sold'`).get() as any).c;
  const totalCards = (db.prepare(`SELECT COUNT(*) as c FROM cards`).get() as any).c;
  const openTickets = (db.prepare(`SELECT COUNT(*) as c FROM tickets WHERE status = 'open'`).get() as any).c;
  const pendingRefunds = (db.prepare(`SELECT COUNT(*) as c FROM refunds WHERE status = 'pending'`).get() as any)?.c ?? 0;

  // Revenue stats
  const totalRevenue = (db.prepare(`SELECT COALESCE(SUM(total), 0) as v FROM orders`).get() as any).v;
  const todayRevenue = (db.prepare(`SELECT COALESCE(SUM(total), 0) as v FROM orders WHERE date(created_at) = date('now')`).get() as any).v;
  const weekRevenue = (db.prepare(`SELECT COALESCE(SUM(total), 0) as v FROM orders WHERE created_at >= datetime('now', '-7 days')`).get() as any).v;
  const monthRevenue = (db.prepare(`SELECT COALESCE(SUM(total), 0) as v FROM orders WHERE created_at >= datetime('now', '-30 days')`).get() as any).v;

  // Total deposits
  const totalDeposits = (db.prepare(`SELECT COALESCE(SUM(amount), 0) as v FROM deposits WHERE status = 'approved'`).get() as any).v;
  const totalPayoutsPaid = (db.prepare(`SELECT COALESCE(SUM(amount), 0) as v FROM payouts WHERE status = 'paid'`).get() as any).v;

  // Daily revenue for chart (last 30 days)
  const dailyRevenue = db.prepare(`
    SELECT date(created_at) as day, COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders
    FROM orders
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all();

  // Top sellers
  const topSellers = db.prepare(`
    SELECT u.username, u.id, COUNT(c.id) as cards_sold, COALESCE(SUM(c.price), 0) as total_sold
    FROM users u
    JOIN cards c ON c.seller_id = u.id AND c.status = 'sold'
    WHERE u.role = 'seller'
    GROUP BY u.id
    ORDER BY total_sold DESC
    LIMIT 10
  `).all();

  // Recent orders
  const recentOrders = db.prepare(`
    SELECT o.id, o.total, o.status, o.created_at, u.username as buyer
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
    LIMIT 10
  `).all();

  res.json({
    totalUsers, totalSellers, totalBuyers, pendingDeposits, pendingPayouts, pendingApps,
    cardsAvailable, cardsSold, totalCards, openTickets, pendingRefunds,
    totalRevenue, todayRevenue, weekRevenue, monthRevenue,
    totalDeposits, totalPayoutsPaid,
    dailyRevenue, topSellers, recentOrders,
  });
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

// ── Impersonate user (generate token for admin to login as user) ──
adminRouter.post("/users/:id/impersonate", async (req, res) => {
  const user = db.prepare(`SELECT id, email, username, role FROM users WHERE id = ?`).get(req.params.id) as any;
  if (!user) return res.status(404).json({ error: "User not found" });

  const jwt = await import("jsonwebtoken");
  const secret = process.env.JWT_SECRET || "dev-secret";
  const token = jwt.default.sign(
    { sub: user.id, email: user.email, username: user.username, role: user.role, impersonated_by: req.user!.id },
    secret,
    { expiresIn: "1h" }
  );

  res.json({ token, user: { id: user.id, email: user.email, username: user.username, role: user.role } });
});

// ── News / broadcast management ──
adminRouter.get("/news", (_req, res) => {
  const rows = db.prepare(`SELECT * FROM news ORDER BY created_at DESC LIMIT 50`).all();
  res.json({ news: rows });
});

adminRouter.post("/news", (req, res) => {
  const { title, body, type } = req.body;
  if (!title || !body) return res.status(400).json({ error: "title and body required" });
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
  db.prepare(`INSERT INTO news (id, title, body, type, created_at) VALUES (?, ?, ?, ?, datetime('now'))`).run(id, title, body, type || "update");
  res.json({ id });
});

adminRouter.delete("/news/:id", (req, res) => {
  db.prepare(`DELETE FROM news WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});
