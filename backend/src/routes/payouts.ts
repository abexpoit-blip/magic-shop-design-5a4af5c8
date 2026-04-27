import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const payoutsRouter = Router();

const reqSchema = z.object({
  amount: z.number().positive().max(100000),
  method: z.enum(["btc", "ltc", "usdt_trc20", "usdt_erc20", "other"]),
  destination: z.string().min(5).max(200),
});

payoutsRouter.post("/", requireAuth, requireRole("seller"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const d = reqSchema.parse(req.body);
    await client.query("BEGIN");
    const { rows: w } = await client.query(`SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE`, [req.user!.id]);
    const bal = Number(w[0]?.balance ?? 0);
    if (bal < d.amount) { await client.query("ROLLBACK"); return res.status(402).json({ error: "Insufficient balance", balance: bal }); }
    await client.query(`UPDATE wallets SET balance = balance - $2, updated_at=now() WHERE user_id=$1`, [req.user!.id, d.amount]);
    const { rows } = await client.query(
      `INSERT INTO payouts (seller_id, amount, method, destination) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user!.id, d.amount, d.method, d.destination]
    );
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, ref_id, meta)
       VALUES ($1,'payout',$2,$3,$4)`,
      [req.user!.id, -d.amount, rows[0].id, JSON.stringify({ method: d.method })]
    );
    await client.query("COMMIT");
    res.json({ payout: rows[0] });
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); next(e); }
  finally { client.release(); }
});

payoutsRouter.get("/mine", requireAuth, requireRole("seller"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM payouts WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.user!.id]
    );
    res.json({ payouts: rows });
  } catch (e) { next(e); }
});

payoutsRouter.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const status = (req.query.status as string) || "pending";
    const { rows } = await pool.query(
      `SELECT p.*, u.email, u.username FROM payouts p
         JOIN users u ON u.id = p.seller_id
        WHERE p.status=$1 ORDER BY p.created_at DESC`,
      [status]
    );
    res.json({ payouts: rows });
  } catch (e) { next(e); }
});

const decideSchema = z.object({ admin_notes: z.string().max(500).optional() });

payoutsRouter.post("/:id/complete", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { admin_notes } = decideSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE payouts SET status='completed', admin_notes=$2, reviewed_by=$3, reviewed_at=now()
        WHERE id=$1 AND status='pending' RETURNING *`,
      [req.params.id, admin_notes ?? null, req.user!.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found or not pending" });
    res.json({ payout: rows[0] });
  } catch (e) { next(e); }
});

payoutsRouter.post("/:id/reject", requireAuth, requireRole("admin"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { admin_notes } = decideSchema.parse(req.body);
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE payouts SET status='rejected', admin_notes=$2, reviewed_by=$3, reviewed_at=now()
        WHERE id=$1 AND status='pending' RETURNING *`,
      [req.params.id, admin_notes ?? null, req.user!.id]
    );
    if (!rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found or not pending" }); }
    // Refund the held amount back to seller wallet.
    await client.query(`UPDATE wallets SET balance = balance + $2, updated_at=now() WHERE user_id=$1`, [rows[0].seller_id, rows[0].amount]);
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, ref_id, meta)
       VALUES ($1,'adjustment',$2,$3,$4)`,
      [rows[0].seller_id, rows[0].amount, rows[0].id, JSON.stringify({ reason: "payout_rejected" })]
    );
    await client.query("COMMIT");
    res.json({ payout: rows[0] });
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); next(e); }
  finally { client.release(); }
});
