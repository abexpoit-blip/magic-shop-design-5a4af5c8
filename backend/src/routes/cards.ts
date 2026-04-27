import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";
import { encryptField, decryptField } from "../crypto.js";

export const cardsRouter = Router();

// ---- public-ish browse (auth required) ----
cardsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    const filters: string[] = [`status = 'available'`];
    const params: any[] = [];
    const add = (cond: string, val: any) => { params.push(val); filters.push(cond.replace("?", `$${params.length}`)); };
    if (req.query.brand)   add("brand = ?",   String(req.query.brand));
    if (req.query.country) add("country = ?", String(req.query.country));
    if (req.query.bin)     add("bin LIKE ?",  String(req.query.bin) + "%");
    if (req.query.min)     add("price >= ?",  Number(req.query.min));
    if (req.query.max)     add("price <= ?",  Number(req.query.max));

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT id, brand, bin, last4, country, state, zip, level, type, bank,
              price, exp_month, exp_year, created_at
         FROM cards ${where}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json({ cards: rows });
  } catch (e) { next(e); }
});

// ---- seller creates a card ----
const createSchema = z.object({
  brand: z.string().max(40).optional(),
  bin: z.string().regex(/^\d{6,8}$/).optional(),
  last4: z.string().regex(/^\d{4}$/).optional(),
  country: z.string().max(40).optional(),
  state: z.string().max(40).optional(),
  zip: z.string().max(20).optional(),
  level: z.string().max(40).optional(),
  type: z.string().max(40).optional(),
  bank: z.string().max(80).optional(),
  price: z.number().positive(),
  cc_number: z.string().min(12).max(19),
  cvv: z.string().min(3).max(4),
  exp_month: z.number().int().min(1).max(12),
  exp_year: z.number().int().min(2024).max(2099),
  holder_name: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
});

cardsRouter.post("/", requireAuth, requireRole("seller"), async (req, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const bin = d.bin ?? d.cc_number.slice(0, 6);
    const last4 = d.last4 ?? d.cc_number.slice(-4);
    const { rows } = await pool.query(
      `INSERT INTO cards
        (seller_id, brand, bin, last4, country, state, zip, level, type, bank,
         price, cc_number_enc, cvv_enc, exp_month, exp_year, holder_name, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [req.user!.id, d.brand, bin, last4, d.country, d.state, d.zip, d.level, d.type, d.bank,
       d.price, encryptField(d.cc_number), encryptField(d.cvv),
       d.exp_month, d.exp_year, d.holder_name, d.notes]
    );
    res.json({ id: rows[0].id });
  } catch (e) { next(e); }
});

// ---- seller lists own cards ----
cardsRouter.get("/mine", requireAuth, requireRole("seller"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, brand, bin, last4, country, price, status, created_at, sold_at
         FROM cards WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 500`,
      [req.user!.id]
    );
    res.json({ cards: rows });
  } catch (e) { next(e); }
});

// ---- seller deletes own (only if available) ----
cardsRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user!.roles.includes("admin");
    const q = isAdmin
      ? `DELETE FROM cards WHERE id=$1 RETURNING id`
      : `DELETE FROM cards WHERE id=$1 AND seller_id=$2 AND status='available' RETURNING id`;
    const params = isAdmin ? [req.params.id] : [req.params.id, req.user!.id];
    const { rowCount } = await pool.query(q, params);
    if (!rowCount) return res.status(404).json({ error: "Not found or not deletable" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- buyer reveals purchased card (decrypt) ----
cardsRouter.get("/:id/reveal", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.cc_number_enc, c.cvv_enc, c.exp_month, c.exp_year, c.holder_name,
              c.brand, c.bin, c.last4, c.country, c.state, c.zip,
              EXISTS (
                SELECT 1 FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE oi.card_id = c.id AND o.buyer_id = $2 AND o.status='paid'
              ) AS owned
         FROM cards c WHERE c.id=$1`,
      [req.params.id, req.user!.id]
    );
    const c = rows[0];
    if (!c) return res.status(404).json({ error: "Not found" });
    if (!c.owned && !req.user!.roles.includes("admin")) {
      return res.status(403).json({ error: "Not owned" });
    }
    res.json({
      card: {
        cc_number: decryptField(c.cc_number_enc),
        cvv: decryptField(c.cvv_enc),
        exp_month: c.exp_month, exp_year: c.exp_year,
        holder_name: c.holder_name, brand: c.brand,
        bin: c.bin, last4: c.last4,
        country: c.country, state: c.state, zip: c.zip,
      },
    });
  } catch (e) { next(e); }
});
