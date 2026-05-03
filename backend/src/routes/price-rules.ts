import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const priceRulesRouter = Router();

// Seller — list my price rules
priceRulesRouter.get("/mine", requireAuth, requireRole("seller"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM price_rules WHERE seller_id = $1 ORDER BY created_at DESC`,
      [req.user!.id]
    );
    res.json({ rules: rows });
  } catch (e) { next(e); }
});

// Seller — create price rule
priceRulesRouter.post("/", requireAuth, requireRole("seller"), async (req, res, next) => {
  try {
    const { country, brand, base, level, price } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO price_rules (seller_id, country, brand, base, level, price)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user!.id, country || null, brand || null, base || null, level || null, price]
    );
    res.status(201).json({ rule: rows[0] });
  } catch (e) { next(e); }
});

// Seller — delete price rule
priceRulesRouter.delete("/:id", requireAuth, requireRole("seller"), async (req, res, next) => {
  try {
    await pool.query(
      `DELETE FROM price_rules WHERE id = $1 AND seller_id = $2`,
      [req.params.id, req.user!.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});
