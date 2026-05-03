import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const ticketsRouter = Router();

ticketsRouter.post("/", requireAuth, (req, res) => {
  const { subject, body } = req.body;
  if (!subject || !body) return res.status(400).json({ error: "subject and body required" });
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  db.transaction(() => {
    db.prepare(`INSERT INTO tickets (id, user_id, subject) VALUES (?, ?, ?)`).run(id, req.user!.id, subject);
    db.prepare(`INSERT INTO ticket_messages (ticket_id, sender_id, body) VALUES (?, ?, ?)`).run(id, req.user!.id, body);
  })();
  res.json({ ticket: { id, status: "open" } });
});

ticketsRouter.get("/mine", requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC`).all(req.user!.id);
  res.json({ tickets: rows });
});

ticketsRouter.get("/:id/messages", requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC`).all(req.params.id);
  res.json({ messages: rows });
});

ticketsRouter.post("/:id/reply", requireAuth, (req, res) => {
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: "body required" });
  db.prepare(`INSERT INTO ticket_messages (ticket_id, sender_id, body) VALUES (?, ?, ?)`).run(req.params.id, req.user!.id, body);
  res.json({ ok: true });
});

ticketsRouter.get("/", requireAuth, requireRole("admin"), (req, res) => {
  const status = req.query.status as string | undefined;
  const rows = status
    ? db.prepare(`SELECT t.*, u.username FROM tickets t JOIN users u ON u.id = t.user_id WHERE t.status = ? ORDER BY t.created_at DESC`).all(status)
    : db.prepare(`SELECT t.*, u.username FROM tickets t JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC`).all();

  // Attach latest message as "message" field for admin view
  const tickets = (rows as any[]).map(t => {
    const msg = db.prepare(`SELECT body FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC LIMIT 1`).get(t.id) as any;
    return { ...t, message: msg?.body || "" };
  });
  res.json({ tickets });
});

ticketsRouter.post("/:id/close", requireAuth, (req, res) => {
  db.prepare(`UPDATE tickets SET status = 'closed' WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});
