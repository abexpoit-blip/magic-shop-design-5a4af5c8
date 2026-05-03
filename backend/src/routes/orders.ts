import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const ordersRouter = Router();

ordersRouter.get("/mine", requireAuth, (req, res) => {
  const orders = db.prepare(
    `SELECT id, total, status, created_at FROM orders
      WHERE buyer_id = ? ORDER BY created_at DESC LIMIT 200`
  ).all(req.user!.id) as any[];

  for (const o of orders) {
    o.items = db.prepare(
      `SELECT oi.card_id, oi.price, c.brand, c.bin, c.last4, c.country
         FROM order_items oi LEFT JOIN cards c ON c.id = oi.card_id
        WHERE oi.order_id = ?`
    ).all(o.id);
  }
  res.json({ orders });
});

ordersRouter.get("/", requireAuth, requireRole("admin"), (_req, res) => {
  const rows = db.prepare(
    `SELECT o.id, o.total, o.status, o.created_at, u.email AS buyer_email
       FROM orders o JOIN users u ON u.id = o.buyer_id
      ORDER BY o.created_at DESC LIMIT 500`
  ).all();
  res.json({ orders: rows });
});
