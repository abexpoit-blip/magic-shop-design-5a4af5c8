import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const sellerAppsRouter = Router();

// ── Submit application (buyer only) ──
sellerAppsRouter.post("/", requireAuth, (req, res) => {
  if (req.user!.role === "seller") return res.status(400).json({ error: "Already a seller" });

  // Check for existing pending application
  const existing = db.prepare(
    `SELECT id FROM seller_applications WHERE user_id = ? AND status = 'pending' LIMIT 1`
  ).get(req.user!.id);
  if (existing) return res.status(409).json({ error: "You already have a pending application" });

  const { telegram, jabber, expected_volume, sample_bins, message } = req.body;
  if (!telegram && !jabber) return res.status(400).json({ error: "Provide at least Telegram or Jabber" });

  const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');

  db.prepare(`
    INSERT INTO seller_applications (id, user_id, reason)
    VALUES (?, ?, ?)
  `).run(id, req.user!.id, JSON.stringify({ telegram, jabber, expected_volume, sample_bins, message }));

  res.json({ application: { id, status: "pending", created_at: new Date().toISOString() } });
});

// ── My applications ──
sellerAppsRouter.get("/mine", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, user_id, status, reason, admin_notes, reviewed_at, created_at
      FROM seller_applications
     WHERE user_id = ?
     ORDER BY created_at DESC
  `).all(req.user!.id);

  // Parse the JSON reason field into individual fields
  const applications = (rows as any[]).map(r => {
    let parsed: any = {};
    try { parsed = JSON.parse(r.reason || "{}"); } catch { /* ignore */ }
    return {
      id: r.id,
      status: r.status,
      telegram: parsed.telegram || null,
      jabber: parsed.jabber || null,
      expected_volume: parsed.expected_volume || null,
      sample_bins: parsed.sample_bins || null,
      message: parsed.message || null,
      admin_note: r.admin_notes,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
    };
  });

  res.json({ applications });
});

// ── Admin: List all applications ──
sellerAppsRouter.get("/", requireAuth, requireRole("admin"), (req, res) => {
  const status = req.query.status as string | undefined;
  let rows;
  if (status) {
    rows = db.prepare(`
      SELECT sa.*, u.username, u.email
        FROM seller_applications sa
        JOIN users u ON u.id = sa.user_id
       WHERE sa.status = ?
       ORDER BY sa.created_at DESC
    `).all(status);
  } else {
    rows = db.prepare(`
      SELECT sa.*, u.username, u.email
        FROM seller_applications sa
        JOIN users u ON u.id = sa.user_id
       ORDER BY sa.created_at DESC
    `).all();
  }

  const applications = (rows as any[]).map(r => {
    let parsed: any = {};
    try { parsed = JSON.parse(r.reason || "{}"); } catch { /* ignore */ }
    return {
      ...r,
      telegram: parsed.telegram || null,
      jabber: parsed.jabber || null,
      expected_volume: parsed.expected_volume || null,
      sample_bins: parsed.sample_bins || null,
      message: parsed.message || null,
    };
  });

  res.json({ applications });
});

// ── Admin: Approve ──
sellerAppsRouter.post("/:id/approve", requireAuth, requireRole("admin"), (req, res) => {
  const app = db.prepare(`SELECT * FROM seller_applications WHERE id = ?`).get(req.params.id) as any;
  if (!app) return res.status(404).json({ error: "Application not found" });
  if (app.status !== "pending") return res.status(400).json({ error: "Already decided" });

  db.transaction(() => {
    db.prepare(`
      UPDATE seller_applications
         SET status = 'approved', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
       WHERE id = ?
    `).run(req.body.admin_notes || null, req.user!.id, req.params.id);

    // Promote user to seller
    db.prepare(`UPDATE users SET role = 'seller', updated_at = datetime('now') WHERE id = ?`).run(app.user_id);
  })();

  res.json({ application: { id: req.params.id, status: "approved" } });
});

// ── Admin: Reject ──
sellerAppsRouter.post("/:id/reject", requireAuth, requireRole("admin"), (req, res) => {
  const app = db.prepare(`SELECT * FROM seller_applications WHERE id = ?`).get(req.params.id) as any;
  if (!app) return res.status(404).json({ error: "Application not found" });
  if (app.status !== "pending") return res.status(400).json({ error: "Already decided" });

  db.prepare(`
    UPDATE seller_applications
       SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
     WHERE id = ?
  `).run(req.body.admin_notes || null, req.user!.id, req.params.id);

  res.json({ application: { id: req.params.id, status: "rejected" } });
});
