import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const depositsRouter = Router();

const submitSchema = z.object({
  amount: z.number().positive().max(100000),
  method: z.enum(["btc", "ltc", "usdt_trc20", "usdt_erc20", "other"]),
  proof_url: z.string().url().max(500).optional(),
  note: z.string().max(500).optional(),
});

depositsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const d = submitSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO deposits (user_id, amount, method, proof_url, admin_notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user!.id, d.amount, d.method, d.proof_url ?? null, d.note ?? null]
    );
    res.json({ deposit: rows[0] });
  } catch (e) { next(e); }
});

depositsRouter.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM deposits WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.user!.id]
    );
    res.json({ deposits: rows });
  } catch (e) { next(e); }
});

// admin
depositsRouter.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const status = (req.query.status as string) || "pending";
    const { rows } = await pool.query(
      `SELECT d.*, u.email, u.username FROM deposits d
         JOIN users u ON u.id = d.user_id
        WHERE d.status=$1 ORDER BY d.created_at DESC`,
      [status]
    );
    res.json({ deposits: rows });
  } catch (e) { next(e); }
});

const decideSchema = z.object({ admin_notes: z.string().max(500).optional() });

depositsRouter.post("/:id/approve", requireAuth, requireRole("admin"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { admin_notes } = decideSchema.parse(req.body);
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE deposits SET status='approved', admin_notes=$2, reviewed_by=$3, reviewed_at=now()
        WHERE id=$1 AND status='pending' RETURNING *`,
      [req.params.id, admin_notes ?? null, req.user!.id]
    );
    if (!rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found or not pending" }); }
    await client.query(
      `INSERT INTO wallets (user_id, balance) VALUES ($1,$2)
         ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at=now()`,
      [rows[0].user_id, rows[0].amount]
    );
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, ref_id, meta)
       VALUES ($1,'deposit',$2,$3,$4)`,
      [rows[0].user_id, rows[0].amount, rows[0].id, JSON.stringify({ method: rows[0].method })]
    );
    await client.query("COMMIT");
    res.json({ deposit: rows[0] });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally { client.release(); }
});

depositsRouter.post("/:id/reject", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { admin_notes } = decideSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE deposits SET status='rejected', admin_notes=$2, reviewed_by=$3, reviewed_at=now()
        WHERE id=$1 AND status='pending' RETURNING *`,
      [req.params.id, admin_notes ?? null, req.user!.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found or not pending" });
    res.json({ deposit: rows[0] });
  } catch (e) { next(e); }
});
