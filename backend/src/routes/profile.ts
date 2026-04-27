import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../auth-middleware.js";

export const profileRouter = Router();

profileRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.username,
              p.display_name, p.avatar_url, p.bio, p.country,
              w.balance,
              COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         LEFT JOIN wallets  w ON w.user_id = u.id
         LEFT JOIN user_roles r ON r.user_id = u.id
        WHERE u.id = $1
        GROUP BY u.id, p.user_id, w.user_id`,
      [req.user!.id]
    );
    res.json({ profile: rows[0] });
  } catch (e) { next(e); }
});

const updateSchema = z.object({
  display_name: z.string().max(64).optional(),
  bio: z.string().max(500).optional(),
  country: z.string().max(64).optional(),
  avatar_url: z.string().url().max(500).optional(),
});

profileRouter.patch("/", requireAuth, async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    await pool.query(
      `UPDATE profiles
          SET display_name = COALESCE($2, display_name),
              bio          = COALESCE($3, bio),
              country      = COALESCE($4, country),
              avatar_url   = COALESCE($5, avatar_url),
              updated_at   = now()
        WHERE user_id = $1`,
      [req.user!.id, data.display_name, data.bio, data.country, data.avatar_url]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});
