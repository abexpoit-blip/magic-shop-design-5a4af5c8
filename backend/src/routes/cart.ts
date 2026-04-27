import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../auth-middleware.js";

export const cartRouter = Router();

// In-memory cart per user (cards are reserved at checkout, not before).
// We keep cart on the client (localStorage); this endpoint validates+checks out.

const checkoutSchema = z.object({
  card_ids: z.array(z.string().uuid()).min(1).max(50),
});

cartRouter.post("/checkout", requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { card_ids } = checkoutSchema.parse(req.body);
    await client.query("BEGIN");

    // Lock cards for update; only available ones count.
    const { rows: cards } = await client.query(
      `SELECT id, seller_id, price FROM cards
        WHERE id = ANY($1::uuid[]) AND status='available'
        FOR UPDATE`,
      [card_ids]
    );
    if (cards.length !== card_ids.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Some cards no longer available" });
    }

    // Buyer can't buy own cards.
    if (cards.some(c => c.seller_id === req.user!.id)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot buy own cards" });
    }

    const total = cards.reduce((s, c) => s + Number(c.price), 0);

    // Lock wallet, check balance.
    const { rows: wRows } = await client.query(
      `SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE`,
      [req.user!.id]
    );
    const balance = Number(wRows[0]?.balance ?? 0);
    if (balance < total) {
      await client.query("ROLLBACK");
      return res.status(402).json({ error: "Insufficient balance", balance, total });
    }

    // Create order.
    const { rows: oRows } = await client.query(
      `INSERT INTO orders (buyer_id, total, status) VALUES ($1,$2,'paid') RETURNING id, created_at`,
      [req.user!.id, total]
    );
    const orderId = oRows[0].id;

    for (const c of cards) {
      await client.query(
        `INSERT INTO order_items (order_id, card_id, seller_id, price)
         VALUES ($1,$2,$3,$4)`,
        [orderId, c.id, c.seller_id, c.price]
      );
      await client.query(
        `UPDATE cards SET status='sold', sold_at=now() WHERE id=$1`,
        [c.id]
      );
      // Credit seller wallet.
      await client.query(
        `INSERT INTO wallets (user_id, balance) VALUES ($1,$2)
           ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at=now()`,
        [c.seller_id, c.price]
      );
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, ref_id, meta)
         VALUES ($1,'purchase',$2,$3,$4)`,
        [c.seller_id, c.price, orderId, JSON.stringify({ card_id: c.id, role: "seller_credit" })]
      );
    }

    // Debit buyer.
    await client.query(`UPDATE wallets SET balance = balance - $2, updated_at=now() WHERE user_id=$1`,
      [req.user!.id, total]);
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, ref_id, meta)
       VALUES ($1,'purchase',$2,$3,$4)`,
      [req.user!.id, -total, orderId, JSON.stringify({ count: cards.length })]
    );

    await client.query("COMMIT");
    res.json({ order_id: orderId, total });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally { client.release(); }
});
