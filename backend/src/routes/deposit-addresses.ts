import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const depositAddressesRouter = Router();

// Public — list active deposit addresses
depositAddressesRouter.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM deposit_addresses WHERE is_active = true ORDER BY method`
    );
    res.json({ addresses: rows });
  } catch (e) { next(e); }
});

// Admin — create
depositAddressesRouter.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { method, address, label } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO deposit_addresses (method, address, label) VALUES ($1,$2,$3) RETURNING *`,
      [method, address, label || null]
    );
    res.status(201).json({ address: rows[0] });
  } catch (e) { next(e); }
});

// Admin — update
depositAddressesRouter.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { method, address, label, is_active } = req.body;
    await pool.query(
      `UPDATE deposit_addresses SET
         method = COALESCE($2, method),
         address = COALESCE($3, address),
         label = COALESCE($4, label),
         is_active = COALESCE($5, is_active)
       WHERE id = $1`,
      [req.params.id, method, address, label, is_active]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});
