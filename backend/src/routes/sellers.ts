import { Router } from "express";
import { db } from "../db.js";

export const sellersRouter = Router();

// Public — list visible sellers (approved sellers)
sellersRouter.get("/visible", (_req, res) => {
  const rows = db.prepare(
    `SELECT u.id, u.username, p.display_name, p.avatar_url, p.bio, p.country
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.role = 'seller' AND u.is_active = 1
      ORDER BY u.username`
  ).all();
  res.json({ sellers: rows });
});

// Public — get seller profile
sellersRouter.get("/:id", (req, res) => {
  const row = db.prepare(
    `SELECT u.id, u.username, p.display_name, p.avatar_url, p.bio, p.country
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = ? AND u.role = 'seller' AND u.is_active = 1`
  ).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Seller not found" });
  res.json({ profile: row });
});

// Public — list seller's available cards
sellersRouter.get("/:id/cards", (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const countRow = db.prepare(`SELECT COUNT(*) as count FROM cards WHERE seller_id = ? AND status = 'available'`).get(req.params.id) as any;
  const cards = db.prepare(
    `SELECT id, bin, brand, country, state, zip, level, type, bank, price, last4, exp_month, exp_year, created_at
       FROM cards WHERE seller_id = ? AND status = 'available'
      ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(req.params.id, limit, offset);

  res.json({ cards, count: countRow?.count ?? 0 });
});
