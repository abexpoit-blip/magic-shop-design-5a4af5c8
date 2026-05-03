import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const newsRouter = Router();

const createNewsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

newsRouter.get("/", (_req, res) => {
  const rows = db.prepare(`SELECT * FROM news WHERE is_active = 1 ORDER BY created_at DESC`).all();
  res.json({ updates: rows });
});

newsRouter.post("/", requireAuth, requireRole("admin"), (req, res, next) => {
  try {
    const { title, body } = createNewsSchema.parse(req.body);
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
    db.prepare(`INSERT INTO news (id, title, body) VALUES (?, ?, ?)`).run(id, title, body);
    res.status(201).json({ update: { id, title, body } });
  } catch (e) { next(e); }
});

newsRouter.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  db.prepare(`DELETE FROM news WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});
