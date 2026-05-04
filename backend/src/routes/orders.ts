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
      `SELECT oi.card_id, oi.price,
              COALESCE(oi.card_bin, c.bin) AS bin,
              COALESCE(oi.card_brand, c.brand) AS brand,
              COALESCE(oi.card_last4, c.last4) AS last4,
              COALESCE(oi.card_country, c.country) AS country,
              COALESCE(oi.card_city, c.city) AS city,
              COALESCE(oi.card_state, c.state) AS state,
              COALESCE(oi.card_zip, c.zip) AS zip,
              COALESCE(oi.card_base, c.base) AS base,
              COALESCE(oi.card_exp_month, c.exp_month) AS exp_month,
              COALESCE(oi.card_exp_year, c.exp_year) AS exp_year,
              COALESCE(oi.card_cc_number, c.cc_number) AS cc_number,
              COALESCE(oi.card_cvv, c.cvv) AS cvv,
              COALESCE(oi.card_holder_name, c.holder_name) AS holder_name,
              COALESCE(oi.card_address, c.address) AS address,
              COALESCE(oi.card_phone, c.phone) AS phone,
              COALESCE(oi.card_email, c.email) AS email
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
