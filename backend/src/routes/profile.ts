import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth-middleware.js";

export const profileRouter = Router();

profileRouter.get("/", requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT u.id, u.email, u.username, u.role,
           p.display_name, p.avatar_url, p.bio, p.country,
           w.balance
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN wallets w ON w.user_id = u.id
     WHERE u.id = ?
  `).get(req.user!.id) as any;

  if (!row) return res.status(404).json({ error: "Profile not found" });

  res.json({
    profile: {
      id: row.id,
      email: row.email,
      username: row.username,
      role: row.role,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      bio: row.bio,
      country: row.country,
      balance: row.balance ?? 0,
    },
  });
});

profileRouter.patch("/", requireAuth, (req, res) => {
  const { display_name, bio, country, avatar_url } = req.body;
  db.prepare(`
    UPDATE profiles
       SET display_name = COALESCE(?, display_name),
           bio = COALESCE(?, bio),
           country = COALESCE(?, country),
           avatar_url = COALESCE(?, avatar_url),
           updated_at = datetime('now')
     WHERE user_id = ?
  `).run(display_name, bio, country, avatar_url, req.user!.id);
  res.json({ ok: true });
});
