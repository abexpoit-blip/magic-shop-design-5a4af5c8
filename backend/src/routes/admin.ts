import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("admin"));

adminRouter.get("/users", async (req, res, next) => {
  try {
    const q = (req.query.q as string) ?? "";
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.username, u.is_active, u.created_at,
              COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles r ON r.user_id = u.id
        WHERE ($1 = '' OR u.email ILIKE '%'||$1||'%' OR u.username ILIKE '%'||$1||'%')
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT 200`,
      [q]
    );
    res.json({ users: rows });
  } catch (e) { next(e); }
});

adminRouter.get("/stats", async (_req, res, next) => {
  try {
    const [{ rows: u }, { rows: s }, { rows: o }] = await Promise.all([
      pool.query(`SELECT count(*)::int AS n FROM users`),
      pool.query(`SELECT count(*)::int AS n FROM seller_applications WHERE status='pending'`),
      pool.query(`SELECT count(*)::int AS n FROM orders`),
    ]);
    res.json({ users: u[0].n, pending_seller_apps: s[0].n, orders: o[0].n });
  } catch (e) { next(e); }
});
