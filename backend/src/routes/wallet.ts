import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth-middleware.js";

export const walletRouter = Router();

walletRouter.get("/", requireAuth, (req, res) => {
  const row = db.prepare(`SELECT balance FROM wallets WHERE user_id = ?`).get(req.user!.id) as any;
  res.json({ balance: Number(row?.balance ?? 0) });
});

walletRouter.get("/transactions", requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT id, type, amount, ref_id, meta, created_at
       FROM transactions WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 200`
  ).all(req.user!.id);
  res.json({ transactions: rows });
});
