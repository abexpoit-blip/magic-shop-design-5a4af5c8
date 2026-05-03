import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const depositsRouter = Router();

depositsRouter.post("/", requireAuth, (req, res) => {
  const { amount, method, proof_url, note } = req.body;
  if (!amount || !method) return res.status(400).json({ error: "amount and method required" });
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  db.prepare(`INSERT INTO deposits (id, user_id, amount, method, proof_url) VALUES (?, ?, ?, ?, ?)`)
    .run(id, req.user!.id, amount, method, proof_url || null);
  res.json({ deposit: { id, status: "pending" } });
});

depositsRouter.get("/mine", requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC`).all(req.user!.id);
  res.json({ deposits: rows });
});

depositsRouter.get("/", requireAuth, requireRole("admin"), (req, res) => {
  const status = req.query.status as string | undefined;
  const rows = status
    ? db.prepare(`SELECT * FROM deposits WHERE status = ? ORDER BY created_at DESC`).all(status)
    : db.prepare(`SELECT * FROM deposits ORDER BY created_at DESC`).all();
  res.json({ deposits: rows });
});

depositsRouter.post("/:id/approve", requireAuth, requireRole("admin"), (req, res) => {
  const dep = db.prepare(`SELECT * FROM deposits WHERE id = ?`).get(req.params.id) as any;
  if (!dep) return res.status(404).json({ error: "Not found" });
  if (dep.status !== "pending") return res.status(400).json({ error: "Already decided" });

  db.transaction(() => {
    db.prepare(`UPDATE deposits SET status = 'approved', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`)
      .run(req.body.admin_notes || null, req.user!.id, req.params.id);
    db.prepare(`UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?`)
      .run(dep.amount, dep.user_id);
    db.prepare(`INSERT INTO transactions (user_id, type, amount, ref_id) VALUES (?, 'deposit', ?, ?)`)
      .run(dep.user_id, dep.amount, dep.id);
  })();

  res.json({ deposit: { id: req.params.id, status: "approved" } });
});

depositsRouter.post("/:id/reject", requireAuth, requireRole("admin"), (req, res) => {
  const dep = db.prepare(`SELECT * FROM deposits WHERE id = ?`).get(req.params.id) as any;
  if (!dep) return res.status(404).json({ error: "Not found" });
  if (dep.status !== "pending") return res.status(400).json({ error: "Already decided" });
  db.prepare(`UPDATE deposits SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`)
    .run(req.body.admin_notes || null, req.user!.id, req.params.id);
  res.json({ deposit: { id: req.params.id, status: "rejected" } });
});
