import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const announcementsRouter = Router();

announcementsRouter.get("/", (_req, res) => {
  const rows = db.prepare(`SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC`).all();
  res.json({ announcements: rows });
});

announcementsRouter.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: "title and body required" });
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  db.prepare(`INSERT INTO announcements (id, title, body) VALUES (?, ?, ?)`).run(id, title, body);
  res.json({ announcement: { id, title, body } });
});

announcementsRouter.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  db.prepare(`DELETE FROM announcements WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});
