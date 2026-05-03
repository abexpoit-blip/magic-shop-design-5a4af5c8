import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const depositAddressesRouter = Router();

const createAddrSchema = z.object({
  method: z.string().trim().min(1, "Method is required").max(50),
  address: z.string().trim().min(1, "Address is required").max(500),
  label: z.string().trim().max(100).optional().nullable(),
});

const updateAddrSchema = z.object({
  method: z.string().trim().min(1).max(50).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  label: z.string().trim().max(100).optional().nullable(),
  is_active: z.boolean().optional(),
});

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
    const parsed = createAddrSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
    const { method, address, label } = parsed.data;
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
    const parsed = updateAddrSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
    const { method, address, label, is_active } = parsed.data;
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
