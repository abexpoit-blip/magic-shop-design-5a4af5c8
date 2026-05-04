import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const cardsRouter = Router();

/* ── BIN → brand detection ── */
function detectBrand(cc: string): string {
  const n = (cc ?? "").replace(/\D/g, "");
  if (/^4/.test(n)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "MASTERCARD";
  if (/^3[47]/.test(n)) return "AMEX";
  if (/^6(011|5|4[4-9])/.test(n)) return "DISCOVER";
  if (/^35/.test(n)) return "JCB";
  if (/^3(0[0-5]|[68])/.test(n)) return "DINERS";
  return "OTHER";
}

function uid(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Browse available cards (authenticated)
cardsRouter.get("/", requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const brand = req.query.brand as string | undefined;
  const country = req.query.country as string | undefined;
  const bin = req.query.bin as string | undefined;
  const base = req.query.base as string | undefined;
  const zip = req.query.zip as string | undefined;
  const seller_id = req.query.seller_id as string | undefined;

  let sql = `SELECT id, seller_id, brand, bin, last4, country, state, zip, city, level, type, bank, price, status,
                    base, refundable, has_phone, has_email, email, exp_month, exp_year, created_at
             FROM cards WHERE status = 'available'`;
  const params: any[] = [];

  if (brand) { sql += ` AND lower(brand) = lower(?)`; params.push(brand); }
  if (country) { sql += ` AND lower(country) = lower(?)`; params.push(country); }
  if (bin) { sql += ` AND bin LIKE ?`; params.push(`${bin}%`); }
  if (base && base !== "all") { sql += ` AND base = ?`; params.push(base); }
  if (zip) { sql += ` AND zip LIKE ?`; params.push(`${zip}%`); }
  if (seller_id) { sql += ` AND seller_id = ?`; params.push(seller_id); }
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

// Add single card (seller/admin)
cardsRouter.post("/", requireAuth, requireRole("seller", "admin"), (req, res) => {
  const { bin, last4, country, state, zip, city, level, type, bank, price,
          cc_data, cc_number, cvv, exp_month, exp_year, holder_name, notes,
          base, refundable, has_phone, has_email, email, phone, address } = req.body;
  if (!price) return res.status(400).json({ error: "price required" });

  const brand = detectBrand(cc_number || bin || "");
  const id = uid();

  db.prepare(`
    INSERT INTO cards (id, seller_id, brand, bin, last4, country, state, zip, city, level, type, bank, price,
                       cc_data, cc_number, cvv, exp_month, exp_year, holder_name, notes,
                       base, refundable, has_phone, has_email, email, phone, address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user!.id, brand, bin, last4, country, state, zip, city, level, type, bank, price,
         cc_data, cc_number, cvv, exp_month, exp_year, holder_name, notes,
         base, refundable ? 1 : 0, has_phone ? 1 : 0, has_email ? 1 : 0, email, phone, address);
  res.json({ id });
});

// ── Bulk create (seller/admin) ──
cardsRouter.post("/bulk", requireAuth, requireRole("seller", "admin"), (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "Array of cards required" });
  if (rows.length > 5000) return res.status(400).json({ error: "Max 5000 cards per batch" });

  const insert = db.prepare(`
    INSERT INTO cards (id, seller_id, brand, bin, last4, country, state, zip, city, level, type, bank, price,
                       cc_data, cc_number, cvv, exp_month, exp_year, holder_name, notes,
                       base, refundable, has_phone, has_email, email, phone, address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?)
  `);

  const sellerId = req.user!.id;
  let count = 0;

  const tx = db.transaction(() => {
    for (const r of rows) {
      const ccNum = r.cc_number || r.cc || "";
      const binVal = r.bin || ccNum.slice(0, 6);
      const brand = detectBrand(ccNum || binVal);
      const last4 = ccNum.length >= 4 ? ccNum.slice(-4) : r.last4 || "";
      const id = uid();

      insert.run(
        id, sellerId, brand,
        binVal, last4,
        r.country || null, r.state || null, r.zip || null, r.city || null,
        r.level || null, r.type || null, r.bank || null,
        Number(r.price) || 0,
        r.cc_data || ccNum || null, r.cc_number || ccNum || null,
        r.cvv || null, r.exp_month || null, r.exp_year || null,
        r.holder_name || null, r.notes || null,
        r.base || null, r.refundable ? 1 : 0,
        r.has_phone ? 1 : 0, r.has_email ? 1 : 0,
        r.email || null, r.phone || null, r.address || null
      );
      count++;
    }
  });

  try {
    tx();
    res.json({ count });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Bulk insert failed" });
  }
});

// ── Bulk update (seller) ──
cardsRouter.post("/bulk-update", requireAuth, requireRole("seller", "admin"), (req, res) => {
  const { ids, price } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids required" });

  const sellerId = req.user!.id;
  const isAdmin = req.user!.role === "admin";

  const sets: string[] = [];
  const vals: any[] = [];
  if (price !== undefined) { sets.push("price = ?"); vals.push(Number(price)); }
  if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });

  const placeholders = ids.map(() => "?").join(",");
  let sql = `UPDATE cards SET ${sets.join(", ")} WHERE id IN (${placeholders})`;
  if (!isAdmin) sql += ` AND seller_id = ?`;

  const params = [...vals, ...ids];
  if (!isAdmin) params.push(sellerId);

  db.prepare(sql).run(...params);
  res.json({ ok: true });
});

// ── Bulk delete (seller) ──
cardsRouter.post("/bulk-delete", requireAuth, requireRole("seller", "admin"), (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids required" });

  const sellerId = req.user!.id;
  const isAdmin = req.user!.role === "admin";

  const placeholders = ids.map(() => "?").join(",");
  let sql = `DELETE FROM cards WHERE id IN (${placeholders})`;
  if (!isAdmin) sql += ` AND seller_id = ?`;

  const params = [...ids];
  if (!isAdmin) params.push(sellerId);

  db.prepare(sql).run(...params);
  res.json({ ok: true });
});

// ── Update single card (seller/admin) ──
cardsRouter.patch("/:id", requireAuth, (req, res) => {
  const card = db.prepare(`SELECT seller_id FROM cards WHERE id = ?`).get(req.params.id) as any;
  if (!card) return res.status(404).json({ error: "Not found" });
  if (card.seller_id !== req.user!.id && req.user!.role !== "admin") return res.status(403).json({ error: "Forbidden" });

  const allowed = ["price", "brand", "country", "state", "city", "zip", "base", "refundable", "status"];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      sets.push(`${k} = ?`);
      vals.push(k === "refundable" ? (req.body[k] ? 1 : 0) : req.body[k]);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });

  vals.push(req.params.id);
  db.prepare(`UPDATE cards SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// Delete card (owner or admin)
cardsRouter.delete("/:id", requireAuth, (req, res) => {
  const card = db.prepare(`SELECT seller_id, status FROM cards WHERE id = ?`).get(req.params.id) as any;
  if (!card) return res.status(404).json({ error: "Not found" });
  if (card.seller_id !== req.user!.id && req.user!.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  
  try {
    db.transaction(() => {
      // Remove FK references so card can be deleted (snapshot data already stored in order_items columns)
      db.prepare(`DELETE FROM order_items WHERE card_id = ?`).run(req.params.id);
      db.prepare(`DELETE FROM cart_items WHERE card_id = ?`).run(req.params.id);
      db.prepare(`DELETE FROM cards WHERE id = ?`).run(req.params.id);
    })();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Delete failed" });
  }
});

// ── Reveal full card data (buyer after purchase or seller/admin) ──
cardsRouter.get("/:id/reveal", requireAuth, (req, res) => {
  const card = db.prepare(`SELECT * FROM cards WHERE id = ?`).get(req.params.id) as any;
  if (!card) return res.status(404).json({ error: "Not found" });

  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const isSeller = card.seller_id === userId;
  // Check if buyer purchased this card
  const order = db.prepare(`SELECT id FROM orders WHERE buyer_id = ? AND card_id = ?`).get(userId, req.params.id) as any;

  if (!isAdmin && !isSeller && !order) return res.status(403).json({ error: "Forbidden" });
  res.json({ card });
});

// Admin browse all cards
cardsRouter.get("/all", requireAuth, requireRole("admin"), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const rows = db.prepare(`SELECT * FROM cards ORDER BY created_at DESC LIMIT ?`).all(limit);
  res.json({ cards: rows });
});
