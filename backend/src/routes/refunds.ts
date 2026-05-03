import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const refundsRouter = Router();

// Buyer — create refund request
refundsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const { order_id, card_id, amount, reason } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO refunds (buyer_id, order_id, card_id, amount, reason)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user!.id, order_id || null, card_id || null, amount, reason || null]
    );
    res.status(201).json({ refund: rows[0] });
  } catch (e) { next(e); }
});

// Admin — list all refunds (optional ?status=)
refundsRouter.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    let q = `SELECT r.*, u.username AS buyer_username FROM refunds r
             JOIN users u ON u.id = r.buyer_id`;
    const params: unknown[] = [];
    if (status) { q += ` WHERE r.status = $1`; params.push(status); }
    q += ` ORDER BY r.created_at DESC`;
    const { rows } = await pool.query(q, params);
    res.json({ refunds: rows });
  } catch (e) { next(e); }
});

// Admin — approve
refundsRouter.post("/:id/approve", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { resolution_note } = req.body;
    const { rows } = await pool.query(
      `UPDATE refunds SET status='approved', resolution_note=$2, reviewed_by=$3, reviewed_at=now()
       WHERE id=$1 RETURNING *`,
      [req.params.id, resolution_note || null, req.user!.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    // credit buyer wallet
    const r = rows[0];
    await pool.query(`UPDATE wallets SET balance = balance + $2, updated_at=now() WHERE user_id=$1`, [r.buyer_id, r.amount]);
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, ref_id) VALUES ($1,'refund',$2,$3)`,
      [r.buyer_id, r.amount, r.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Admin — reject
refundsRouter.post("/:id/reject", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { resolution_note } = req.body;
    const { rows } = await pool.query(
      `UPDATE refunds SET status='rejected', resolution_note=$2, reviewed_by=$3, reviewed_at=now()
       WHERE id=$1 RETURNING *`,
      [req.params.id, resolution_note || null, req.user!.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
