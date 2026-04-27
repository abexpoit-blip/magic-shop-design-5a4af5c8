import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const ordersRouter = Router();

ordersRouter.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.total, o.status, o.created_at,
              COALESCE(json_agg(json_build_object(
                'card_id', oi.card_id, 'price', oi.price,
                'brand', c.brand, 'bin', c.bin, 'last4', c.last4, 'country', c.country
              )) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN cards c ON c.id = oi.card_id
        WHERE o.buyer_id = $1
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 200`,
      [req.user!.id]
    );
    res.json({ orders: rows });
  } catch (e) { next(e); }
});

ordersRouter.get("/", requireAuth, requireRole("admin"), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.total, o.status, o.created_at, u.email AS buyer_email
         FROM orders o JOIN users u ON u.id = o.buyer_id
        ORDER BY o.created_at DESC LIMIT 500`
    );
    res.json({ orders: rows });
  } catch (e) { next(e); }
});
