import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const siteSettingsRouter = Router();

// Public — get all settings as a flat object
siteSettingsRouter.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT key, value FROM site_settings");
    const settings: Record<string, unknown> = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json({ settings });
  } catch (e) { next(e); }
});

// Admin — upsert settings (body is { key: value, ... })
siteSettingsRouter.put("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const bodySchema = z.record(z.string().max(100), z.unknown());
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid settings payload" });
    const entries = Object.entries(parsed.data);
    if (entries.length === 0) return res.status(400).json({ error: "No settings provided" });
    if (entries.length > 50) return res.status(400).json({ error: "Too many settings at once (max 50)" });
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [key, JSON.stringify(value)]
      );
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});
