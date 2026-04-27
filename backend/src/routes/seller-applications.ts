import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const sellerAppsRouter = Router();

const submitSchema = z.object({ reason: z.string().min(20).max(2000) });

// Logged-in user submits a seller application.
sellerAppsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const { reason } = submitSchema.parse(req.body);

    // Already a seller?
    if (req.user!.roles.includes("seller")) {
      return res.status(409).json({ error: "You are already a seller" });
    }
    // Existing pending app?
    const pending = await pool.query(
      `SELECT 1 FROM seller_applications WHERE user_id=$1 AND status='pending' LIMIT 1`,
      [req.user!.id]
    );
    if (pending.rowCount) return res.status(409).json({ error: "Application already pending" });

    const { rows } = await pool.query(
      `INSERT INTO seller_applications (user_id, reason) VALUES ($1,$2) RETURNING *`,
      [req.user!.id, reason]
    );
    res.json({ application: rows[0] });
  } catch (e) { next(e); }
});

sellerAppsRouter.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM seller_applications WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user!.id]
    );
    res.json({ applications: rows });
  } catch (e) { next(e); }
});

// --- Admin endpoints ---
sellerAppsRouter.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const status = (req.query.status as string) || "pending";
    const { rows } = await pool.query(
      `SELECT a.*, u.email, u.username
         FROM seller_applications a
         JOIN users u ON u.id = a.user_id
        WHERE a.status = $1::seller_app_status
        ORDER BY a.created_at DESC`,
      [status]
    );
    res.json({ applications: rows });
  } catch (e) { next(e); }
});

const decideSchema = z.object({ admin_notes: z.string().max(1000).optional() });

sellerAppsRouter.post("/:id/approve", requireAuth, requireRole("admin"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { admin_notes } = decideSchema.parse(req.body);
    await client.query("BEGIN");
    const a = await client.query(
      `UPDATE seller_applications
          SET status='approved', admin_notes=$2, reviewed_by=$3, reviewed_at=now()
        WHERE id=$1 AND status='pending'
        RETURNING *`,
      [req.params.id, admin_notes ?? null, req.user!.id]
    );
    if (!a.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found or not pending" }); }
    await client.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1,'seller') ON CONFLICT DO NOTHING`,
      [a.rows[0].user_id]
    );
    await client.query(
      `INSERT INTO audit_log (actor_id, action, target, meta) VALUES ($1,'seller.approve',$2,$3)`,
      [req.user!.id, a.rows[0].user_id, JSON.stringify({ application_id: a.rows[0].id })]
    );
    await client.query("COMMIT");
    res.json({ application: a.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally { client.release(); }
});

sellerAppsRouter.post("/:id/reject", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { admin_notes } = decideSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE seller_applications
          SET status='rejected', admin_notes=$2, reviewed_by=$3, reviewed_at=now()
        WHERE id=$1 AND status='pending'
        RETURNING *`,
      [req.params.id, admin_notes ?? null, req.user!.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found or not pending" });
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, target, meta) VALUES ($1,'seller.reject',$2,$3)`,
      [req.user!.id, rows[0].user_id, JSON.stringify({ application_id: rows[0].id })]
    );
    res.json({ application: rows[0] });
  } catch (e) { next(e); }
});
