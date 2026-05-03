import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const refundsRouter = Router();

function genId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
}

const createRefundSchema = z.object({
  order_id: z.string().optional().nullable(),
  card_id: z.string().optional().nullable(),
  amount: z.number().positive().max(100000),
  reason: z.string().trim().max(1000).optional().nullable(),
});

const decisionSchema = z.object({
  resolution_note: z.string().trim().max(1000).optional().nullable(),
});

// Buyer — create refund request
refundsRouter.post("/", requireAuth, (req, res, next) => {
  try {
    const { order_id, card_id, amount, reason } = createRefundSchema.parse(req.body);
    const id = genId();
    db.prepare(
      `INSERT INTO refunds (id, user_id, order_id, card_id, amount, reason) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, order_id || null, card_id || null, amount, reason || null);
    res.status(201).json({ refund: { id, amount, status: "pending" } });
  } catch (e) { next(e); }
});

// Buyer — list my refunds
refundsRouter.get("/mine", requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM refunds WHERE user_id = ? ORDER BY created_at DESC`).all(req.user!.id);
  res.json({ refunds: rows });
});

// Admin — list all refunds
refundsRouter.get("/", requireAuth, requireRole("admin"), (req, res) => {
  const status = req.query.status as string | undefined;
  let rows;
  if (status) {
    rows = db.prepare(
      `SELECT r.*, u.username AS buyer_username FROM refunds r JOIN users u ON u.id = r.user_id WHERE r.status = ? ORDER BY r.created_at DESC`
    ).all(status);
  } else {
    rows = db.prepare(
      `SELECT r.*, u.username AS buyer_username FROM refunds r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC`
    ).all();
  }
  res.json({ refunds: rows });
});

// Admin — approve
refundsRouter.post("/:id/approve", requireAuth, requireRole("admin"), (req, res, next) => {
  try {
    const { resolution_note } = decisionSchema.parse(req.body);
    const refund = db.prepare(`SELECT * FROM refunds WHERE id = ? AND status = 'pending'`).get(req.params.id) as any;
    if (!refund) return res.status(404).json({ error: "Not found" });

    db.transaction(() => {
      db.prepare(`UPDATE refunds SET status = 'approved', resolution_note = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`).run(resolution_note || null, req.user!.id, req.params.id);
      db.prepare(`UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?`).run(refund.amount, refund.user_id);
      db.prepare(`INSERT INTO transactions (id, user_id, type, amount, ref_id) VALUES (?, ?, 'refund', ?, ?)`).run(genId(), refund.user_id, refund.amount, refund.id);
    })();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Admin — reject
refundsRouter.post("/:id/reject", requireAuth, requireRole("admin"), (req, res, next) => {
  try {
    const { resolution_note } = decisionSchema.parse(req.body);
    const info = db.prepare(`UPDATE refunds SET status = 'rejected', resolution_note = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`).run(resolution_note || null, req.user!.id, req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
