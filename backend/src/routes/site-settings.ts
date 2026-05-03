import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const siteSettingsRouter = Router();

siteSettingsRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT key, value FROM site_settings").all() as any[];
  const settings: Record<string, unknown> = {};
  for (const r of rows) {
    try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; }
  }
  res.json({ settings });
});

siteSettingsRouter.put("/", requireAuth, requireRole("admin"), (req, res, next) => {
  try {
    const bodySchema = z.record(z.string().max(100), z.unknown());
    const parsed = bodySchema.parse(req.body);
    const entries = Object.entries(parsed);
    if (entries.length === 0) return res.status(400).json({ error: "No settings provided" });

    const stmt = db.prepare(`INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
    const tx = db.transaction(() => {
      for (const [key, value] of entries) stmt.run(key, JSON.stringify(value));
    });
    tx();
    res.json({ ok: true });
  } catch (e) { next(e); }
});
