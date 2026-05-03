import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const priceRulesRouter = Router();

const createRuleSchema = z.object({
  country: z.string().trim().max(100).optional().nullable(),
  brand: z.string().trim().max(100).optional().nullable(),
  bin: z.string().trim().max(100).optional().nullable(),
  price: z.number().positive().max(100000),
});

priceRulesRouter.get("/mine", requireAuth, requireRole("seller"), (req, res) => {
  const rows = db.prepare(`SELECT * FROM price_rules WHERE seller_id = ? ORDER BY created_at DESC`).all(req.user!.id);
  res.json({ rules: rows });
});

priceRulesRouter.post("/", requireAuth, requireRole("seller"), (req, res, next) => {
  try {
    const { country, brand, bin, price } = createRuleSchema.parse(req.body);
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
    db.prepare(`INSERT INTO price_rules (id, seller_id, country, brand, bin, price) VALUES (?, ?, ?, ?, ?, ?)`).run(id, req.user!.id, country || null, brand || null, bin || null, price);
    res.status(201).json({ rule: { id, country, brand, bin, price } });
  } catch (e) { next(e); }
});

priceRulesRouter.delete("/:id", requireAuth, requireRole("seller"), (req, res) => {
  db.prepare(`DELETE FROM price_rules WHERE id = ? AND seller_id = ?`).run(req.params.id, req.user!.id);
  res.json({ ok: true });
});
