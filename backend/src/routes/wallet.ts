import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../auth-middleware.js";

export const walletRouter = Router();

walletRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT balance FROM wallets WHERE user_id=$1`, [req.user!.id]
    );
    res.json({ balance: Number(rows[0]?.balance ?? 0) });
  } catch (e) { next(e); }
});

walletRouter.get("/transactions", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, type, amount, ref_id, meta, created_at
         FROM transactions WHERE user_id=$1
        ORDER BY created_at DESC LIMIT 200`,
      [req.user!.id]
    );
    res.json({ transactions: rows });
  } catch (e) { next(e); }
});
