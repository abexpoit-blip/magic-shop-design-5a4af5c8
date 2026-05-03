import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const newsRouter = Router();

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
    const { title, body } = req.body;
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
