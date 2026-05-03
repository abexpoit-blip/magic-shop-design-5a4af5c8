import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const depositAddressesRouter = Router();

function genId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
}

const createAddrSchema = z.object({
  method: z.string().trim().min(1).max(50),
  address: z.string().trim().min(1).max(500),
  label: z.string().trim().max(100).optional().nullable(),
});

const updateAddrSchema = z.object({
  method: z.string().trim().min(1).max(50).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  label: z.string().trim().max(100).optional().nullable(),
  is_active: z.boolean().optional(),
});

depositAddressesRouter.get("/", (_req, res) => {
  const rows = db.prepare(`SELECT * FROM deposit_addresses WHERE is_active = 1 ORDER BY method`).all();
  res.json({ addresses: rows });
});

depositAddressesRouter.post("/", requireAuth, requireRole("admin"), (req, res, next) => {
  try {
    const { method, address, label } = createAddrSchema.parse(req.body);
    const id = genId();
    db.prepare(`INSERT INTO deposit_addresses (id, method, address, label) VALUES (?, ?, ?, ?)`).run(id, method, address, label || null);
    res.status(201).json({ address: { id, method, address, label } });
  } catch (e) { next(e); }
});

depositAddressesRouter.patch("/:id", requireAuth, requireRole("admin"), (req, res, next) => {
  try {
    const { method, address, label, is_active } = updateAddrSchema.parse(req.body);
    db.prepare(
      `UPDATE deposit_addresses SET
         method = COALESCE(?, method),
         address = COALESCE(?, address),
         label = COALESCE(?, label),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`
    ).run(method ?? null, address ?? null, label ?? null, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
