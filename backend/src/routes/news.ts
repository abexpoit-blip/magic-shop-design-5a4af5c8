import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const newsRouter = Router();

const createNewsSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title too long"),
  body: z.string().trim().min(1, "Body is required").max(5000, "Body too long"),
});

// Public — list active news
newsRouter.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM news_updates WHERE is_active = true ORDER BY created_at DESC`
    );
    res.json({ updates: rows });
  } catch (e) { next(e); }
});

// Admin — create news
newsRouter.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const parsed = createNewsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
    const { title, body } = parsed.data;
    const { rows } = await pool.query(
      `INSERT INTO news_updates (title, body) VALUES ($1, $2) RETURNING *`,
      [title, body]
    );
    res.status(201).json({ update: rows[0] });
  } catch (e) { next(e); }
});

// Admin — delete news
newsRouter.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM news_updates WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
