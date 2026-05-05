import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const depositsRouter = Router();

depositsRouter.post("/", requireAuth, (req, res) => {
  const { amount, method, proof_url, note } = req.body;
  if (!amount || !method) return res.status(400).json({ error: "amount and method required" });
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  db.prepare(`INSERT INTO deposits (id, user_id, amount, method, proof_url) VALUES (?, ?, ?, ?, ?)`)
    .run(id, req.user!.id, amount, method, note || proof_url || null);
  res.json({ deposit: { id, status: "pending" } });
});

depositsRouter.get("/mine", requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC`).all(req.user!.id);
  res.json({ deposits: rows });
});

depositsRouter.get("/", requireAuth, requireRole("admin"), (req, res) => {
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  let query = `SELECT d.*, u.email as user_email, u.username as user_username
               FROM deposits d LEFT JOIN users u ON d.user_id = u.id`;
  const conditions: string[] = [];
  const params: any[] = [];

  if (status) {
    conditions.push("d.status = ?");
    params.push(status);
  }

  if (search) {
    const like = `%${search}%`;
    conditions.push("(u.email LIKE ? OR u.username LIKE ? OR d.plisio_invoice_id LIKE ? OR d.txid LIKE ? OR d.id LIKE ?)");
    params.push(like, like, like, like, like);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY d.created_at DESC LIMIT 200";

  const rows = db.prepare(query).all(...params);
  res.json({ deposits: rows });
});

depositsRouter.post("/:id/approve", requireAuth, requireRole("admin"), (req, res) => {
  const dep = db.prepare(`SELECT * FROM deposits WHERE id = ?`).get(req.params.id) as any;
  if (!dep) return res.status(404).json({ error: "Not found" });
  if (dep.status !== "pending") return res.status(400).json({ error: "Already decided" });

  // Bonus tiers
  const amount = Number(dep.amount);
  const bonusTiers = [
    { min: 5000, bonus: 750 },
    { min: 2000, bonus: 240 },
    { min: 1000, bonus: 100 },
    { min: 500, bonus: 35 },
    { min: 100, bonus: 5 },
    { min: 50, bonus: 2 },
  ];
  const tier = bonusTiers.find(t => amount >= t.min);
  const bonus = tier ? tier.bonus : 0;
  const totalCredit = Math.round((amount + bonus) * 100) / 100;

  db.transaction(() => {
    db.prepare(`UPDATE deposits SET status = 'approved', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`)
      .run(req.body.admin_notes || null, req.user!.id, req.params.id);
    db.prepare(`UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?`)
      .run(totalCredit, dep.user_id);
    db.prepare(`INSERT INTO transactions (user_id, type, amount, ref_id) VALUES (?, 'deposit', ?, ?)`)
      .run(dep.user_id, amount, dep.id);
    if (bonus > 0) {
      db.prepare(`INSERT INTO transactions (user_id, type, amount, ref_id, meta) VALUES (?, 'adjustment', ?, ?, ?)`)
        .run(dep.user_id, bonus, dep.id, JSON.stringify({ reason: `Deposit bonus for $${amount} deposit` }));
    }
  })();

  res.json({ deposit: { id: req.params.id, status: "approved", bonus } });
});

depositsRouter.post("/:id/reject", requireAuth, requireRole("admin"), (req, res) => {
  const dep = db.prepare(`SELECT * FROM deposits WHERE id = ?`).get(req.params.id) as any;
  if (!dep) return res.status(404).json({ error: "Not found" });
  if (dep.status !== "pending") return res.status(400).json({ error: "Already decided" });
  db.prepare(`UPDATE deposits SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`)
    .run(req.body.admin_notes || null, req.user!.id, req.params.id);
  res.json({ deposit: { id: req.params.id, status: "rejected" } });
});
