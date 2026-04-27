import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const ticketsRouter = Router();

const createSchema = z.object({
  subject: z.string().min(3).max(120),
  body: z.string().min(3).max(4000),
});

ticketsRouter.post("/", requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const d = createSchema.parse(req.body);
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO tickets (user_id, subject) VALUES ($1,$2) RETURNING *`,
      [req.user!.id, d.subject]
    );
    await client.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, body) VALUES ($1,$2,$3)`,
      [rows[0].id, req.user!.id, d.body]
    );
    await client.query("COMMIT");
    res.json({ ticket: rows[0] });
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); next(e); }
  finally { client.release(); }
});

ticketsRouter.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tickets WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.user!.id]
    );
    res.json({ tickets: rows });
  } catch (e) { next(e); }
});

ticketsRouter.get("/:id/messages", requireAuth, async (req, res, next) => {
  try {
    // Ensure access (owner or admin).
    const { rows: tRows } = await pool.query(`SELECT user_id FROM tickets WHERE id=$1`, [req.params.id]);
    if (!tRows[0]) return res.status(404).json({ error: "Not found" });
    const isAdmin = req.user!.roles.includes("admin");
    if (tRows[0].user_id !== req.user!.id && !isAdmin) return res.status(403).json({ error: "Forbidden" });
    const { rows } = await pool.query(
      `SELECT m.*, u.username FROM ticket_messages m
         JOIN users u ON u.id = m.sender_id
        WHERE ticket_id=$1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ messages: rows });
  } catch (e) { next(e); }
});

const replySchema = z.object({ body: z.string().min(1).max(4000) });

ticketsRouter.post("/:id/reply", requireAuth, async (req, res, next) => {
  try {
    const { body } = replySchema.parse(req.body);
    const { rows: tRows } = await pool.query(`SELECT user_id, status FROM tickets WHERE id=$1`, [req.params.id]);
    if (!tRows[0]) return res.status(404).json({ error: "Not found" });
    const isAdmin = req.user!.roles.includes("admin");
    if (tRows[0].user_id !== req.user!.id && !isAdmin) return res.status(403).json({ error: "Forbidden" });
    if (tRows[0].status === "closed") return res.status(409).json({ error: "Ticket closed" });
    await pool.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, body) VALUES ($1,$2,$3)`,
      [req.params.id, req.user!.id, body]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// admin
ticketsRouter.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const status = (req.query.status as string) || "open";
    const { rows } = await pool.query(
      `SELECT t.*, u.email, u.username FROM tickets t
         JOIN users u ON u.id = t.user_id
        WHERE t.status=$1 ORDER BY t.created_at DESC`,
      [status]
    );
    res.json({ tickets: rows });
  } catch (e) { next(e); }
});

ticketsRouter.post("/:id/close", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    await pool.query(`UPDATE tickets SET status='closed' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
