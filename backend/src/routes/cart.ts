import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../auth-middleware.js";

export const cartRouter = Router();

function genId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// List cart items
cartRouter.get("/", requireAuth, (req, res) => {
  const items = db.prepare(
    `SELECT ci.id, ci.card_id, c.bin, c.brand, c.country, c.price, c.last4
       FROM cart_items ci LEFT JOIN cards c ON c.id = ci.card_id
      WHERE ci.user_id = ? ORDER BY ci.created_at DESC`
  ).all(req.user!.id);
  res.json({ items });
});

// Add to cart
cartRouter.post("/", requireAuth, (req, res) => {
  const { card_id } = req.body;
  if (!card_id) return res.status(400).json({ error: "card_id required" });
  try {
    db.prepare(`INSERT OR IGNORE INTO cart_items (id, user_id, card_id) VALUES (?, ?, ?)`).run(genId(), req.user!.id, card_id);
    res.json({ ok: true });
  } catch { res.status(409).json({ error: "Already in cart" }); }
});

// Batch add
cartRouter.post("/batch", requireAuth, (req, res) => {
  const { card_ids } = req.body;
  if (!Array.isArray(card_ids)) return res.status(400).json({ error: "card_ids array required" });
  const stmt = db.prepare(`INSERT OR IGNORE INTO cart_items (id, user_id, card_id) VALUES (?, ?, ?)`);
  const tx = db.transaction(() => { for (const cid of card_ids) stmt.run(genId(), req.user!.id, cid); });
  tx();
  res.json({ ok: true });
});

// Remove from cart
cartRouter.delete("/:id", requireAuth, (req, res) => {
  db.prepare(`DELETE FROM cart_items WHERE id = ? AND user_id = ?`).run(req.params.id, req.user!.id);
  res.json({ ok: true });
});

// Checkout
const checkoutSchema = z.object({
  card_ids: z.array(z.string()).min(1).max(50),
});

cartRouter.post("/checkout", requireAuth, (req, res, next) => {
  try {
    const { card_ids } = checkoutSchema.parse(req.body);

    const result = db.transaction(() => {
      // Get available cards
      const placeholders = card_ids.map(() => "?").join(",");
      const cards = db.prepare(
        `SELECT id, seller_id, price FROM cards WHERE id IN (${placeholders}) AND status = 'available'`
      ).all(...card_ids) as any[];

      if (cards.length !== card_ids.length) return { error: "Some cards no longer available", status: 409 };
      if (cards.some(c => c.seller_id === req.user!.id)) return { error: "Cannot buy own cards", status: 400 };

      const total = cards.reduce((s, c) => s + Number(c.price), 0);

      // Check balance
      const wallet = db.prepare(`SELECT balance FROM wallets WHERE user_id = ?`).get(req.user!.id) as any;
      const balance = Number(wallet?.balance ?? 0);
      if (balance < total) return { error: "Insufficient balance", status: 402, balance, total };

      // Create order
      const orderId = genId();
      db.prepare(`INSERT INTO orders (id, buyer_id, total, status) VALUES (?, ?, ?, 'paid')`).run(orderId, req.user!.id, total);

      for (const c of cards) {
        const itemId = genId();
        db.prepare(`INSERT INTO order_items (id, order_id, card_id, seller_id, price) VALUES (?, ?, ?, ?, ?)`).run(itemId, orderId, c.id, c.seller_id, c.price);
        db.prepare(`UPDATE cards SET status = 'sold', sold_at = datetime('now') WHERE id = ?`).run(c.id);
        // Credit seller
        db.prepare(`UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?`).run(c.price, c.seller_id);
        db.prepare(`INSERT INTO transactions (id, user_id, type, amount, ref_id, meta) VALUES (?, ?, 'purchase', ?, ?, ?)`).run(genId(), c.seller_id, c.price, orderId, JSON.stringify({ card_id: c.id, role: "seller_credit" }));
      }

      // Debit buyer
      db.prepare(`UPDATE wallets SET balance = balance - ?, updated_at = datetime('now') WHERE user_id = ?`).run(total, req.user!.id);
      db.prepare(`INSERT INTO transactions (id, user_id, type, amount, ref_id, meta) VALUES (?, ?, 'purchase', ?, ?, ?)`).run(genId(), req.user!.id, -total, orderId, JSON.stringify({ count: cards.length }));

      // Clear cart
      db.prepare(`DELETE FROM cart_items WHERE user_id = ?`).run(req.user!.id);

      return { order_id: orderId, total };
    })();

    if ("error" in result) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch (e) { next(e); }
});
