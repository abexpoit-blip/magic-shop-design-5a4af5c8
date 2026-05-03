import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const cardsRouter = Router();

// Browse available cards (authenticated)
cardsRouter.get("/", requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const brand = req.query.brand as string | undefined;
  const country = req.query.country as string | undefined;
  const bin = req.query.bin as string | undefined;

  let sql = `SELECT id, seller_id, brand, bin, last4, country, state, zip, level, type, bank, price, status, created_at
               FROM cards WHERE status = 'available'`;
  const params: any[] = [];

  if (brand) { sql += ` AND lower(brand) = lower(?)`; params.push(brand); }
  if (country) { sql += ` AND lower(country) = lower(?)`; params.push(country); }
  if (bin) { sql += ` AND bin LIKE ?`; params.push(`${bin}%`); }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params);
  res.json({ cards: rows });
});

// Seller's own cards
cardsRouter.get("/mine", requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM cards WHERE seller_id = ? ORDER BY created_at DESC`).all(req.user!.id);
  res.json({ cards: rows });
});

// Add card (seller/admin)
cardsRouter.post("/", requireAuth, requireRole("seller", "admin"), (req, res) => {
  const { brand, bin, last4, country, state, zip, level, type, bank, price, cc_data, cvv, exp_month, exp_year, holder_name, notes } = req.body;
  if (!price) return res.status(400).json({ error: "price required" });
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  db.prepare(`
    INSERT INTO cards (id, seller_id, brand, bin, last4, country, state, zip, level, type, bank, price, cc_data, cvv, exp_month, exp_year, holder_name, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user!.id, brand, bin, last4, country, state, zip, level, type, bank, price, cc_data, cvv, exp_month, exp_year, holder_name, notes);
  res.json({ id });
});

// Delete card (owner or admin)
cardsRouter.delete("/:id", requireAuth, (req, res) => {
  const card = db.prepare(`SELECT seller_id FROM cards WHERE id = ?`).get(req.params.id) as any;
  if (!card) return res.status(404).json({ error: "Not found" });
  if (card.seller_id !== req.user!.id && req.user!.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  db.prepare(`DELETE FROM cards WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// Admin browse all cards
cardsRouter.get("/all", requireAuth, requireRole("admin"), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const rows = db.prepare(`SELECT * FROM cards ORDER BY created_at DESC LIMIT ?`).all(limit);
  res.json({ cards: rows });
});
