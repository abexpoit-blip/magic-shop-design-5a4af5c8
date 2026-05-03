import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const payoutsRouter = Router();

payoutsRouter.post("/", requireAuth, (req, res) => {
  const { amount, method, destination } = req.body;
  if (!amount || !method || !destination) return res.status(400).json({ error: "amount, method, destination required" });
  const wallet = db.prepare(`SELECT balance FROM wallets WHERE user_id = ?`).get(req.user!.id) as any;
  if (!wallet || wallet.balance < amount) return res.status(400).json({ error: "Insufficient balance" });

  const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  db.transaction(() => {
    db.prepare(`INSERT INTO payouts (id, seller_id, amount, method, destination) VALUES (?, ?, ?, ?, ?)`)
      .run(id, req.user!.id, amount, method, destination);
    db.prepare(`UPDATE wallets SET balance = balance - ?, updated_at = datetime('now') WHERE user_id = ?`)
      .run(amount, req.user!.id);
  })();
  res.json({ payout: { id, status: "pending" } });
});

payoutsRouter.get("/mine", requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM payouts WHERE seller_id = ? ORDER BY created_at DESC`).all(req.user!.id);
  res.json({ payouts: rows });
});

payoutsRouter.get("/", requireAuth, requireRole("admin"), (req, res) => {
  const status = req.query.status as string | undefined;
  const rows = status
    ? db.prepare(`SELECT * FROM payouts WHERE status = ? ORDER BY created_at DESC`).all(status)
    : db.prepare(`SELECT * FROM payouts ORDER BY created_at DESC`).all();
  res.json({ payouts: rows });
});

payoutsRouter.post("/:id/complete", requireAuth, requireRole("admin"), (req, res) => {
  const p = db.prepare(`SELECT * FROM payouts WHERE id = ?`).get(req.params.id) as any;
  if (!p) return res.status(404).json({ error: "Not found" });
  if (p.status !== "pending") return res.status(400).json({ error: "Already decided" });
  db.prepare(`UPDATE payouts SET status = 'completed', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`)
    .run(req.body.admin_notes || null, req.user!.id, req.params.id);
  db.prepare(`INSERT INTO transactions (user_id, type, amount, ref_id) VALUES (?, 'payout', ?, ?)`)
    .run(p.seller_id, -p.amount, p.id);
  res.json({ payout: { id: req.params.id, status: "completed" } });
});

payoutsRouter.post("/:id/reject", requireAuth, requireRole("admin"), (req, res) => {
  const p = db.prepare(`SELECT * FROM payouts WHERE id = ?`).get(req.params.id) as any;
  if (!p) return res.status(404).json({ error: "Not found" });
  if (p.status !== "pending") return res.status(400).json({ error: "Already decided" });
  db.transaction(() => {
    db.prepare(`UPDATE payouts SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`)
      .run(req.body.admin_notes || null, req.user!.id, req.params.id);
    // Refund the held amount
    db.prepare(`UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?`)
      .run(p.amount, p.seller_id);
  })();
  res.json({ payout: { id: req.params.id, status: "rejected" } });
});
