import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const announcementsRouter = Router();

announcementsRouter.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, body, created_at FROM announcements
        WHERE is_active=true ORDER BY created_at DESC LIMIT 20`
    );
    res.json({ announcements: rows });
  } catch (e) { next(e); }
});

const createSchema = z.object({
  title: z.string().min(2).max(200),
  body: z.string().min(2).max(4000),
});

announcementsRouter.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO announcements (title, body) VALUES ($1,$2) RETURNING *`,
      [d.title, d.body]
    );
    res.json({ announcement: rows[0] });
  } catch (e) { next(e); }
});

announcementsRouter.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    await pool.query(`UPDATE announcements SET is_active=false WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
