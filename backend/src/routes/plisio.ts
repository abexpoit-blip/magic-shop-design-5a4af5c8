import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth-middleware.js";

export const plisioRouter = Router();

const PLISIO_API = "https://plisio.net/api/v1";

function getSecretKey(): string {
  const key = process.env.PLISIO_SECRET_KEY;
  if (!key) throw new Error("PLISIO_SECRET_KEY not configured");
  return key;
}

/**
 * POST /api/plisio/create-invoice
 * User-facing: creates a Plisio invoice and returns the wallet address + pay URL.
 * Body: { amount: number, currency: "LTC" | "BTC" | "USDT" | ... }
 */
plisioRouter.post("/create-invoice", requireAuth, async (req: Request, res: Response) => {
  try {
    const { amount, currency } = req.body;
    if (!amount || !currency) {
      return res.status(400).json({ error: "amount and currency required" });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ error: "amount must be positive" });
    }

    // Enforce minimum deposit from site_settings
    let minDeposit = 5;
    try {
      const row = db.prepare(`SELECT value FROM site_settings WHERE key = 'min_deposit'`).get() as any;
      if (row) minDeposit = Number(JSON.parse(row.value)) || 5;
    } catch { /* default */ }
    if (Number(amount) < minDeposit) {
      return res.status(400).json({ error: `Minimum deposit is $${minDeposit}` });
    }

    const secretKey = getSecretKey();
    const depositId = Array.from(crypto.randomBytes(16)).map(b => b.toString(16).padStart(2, "0")).join("");

    // Create the deposit record first (pending)
    db.prepare(`
      INSERT INTO deposits (id, user_id, amount, method, status, crypto_currency)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(depositId, req.user!.id, amount, `crypto_${currency}`, currency);

    // Call Plisio API to create invoice
    const webhookUrl = `${process.env.BASE_URL || "https://cruzercc.shop"}/api/plisio/webhook`;
    const params = new URLSearchParams({
      source_currency: "USD",
      source_amount: String(amount),
      currency: currency,
      order_name: `Deposit ${depositId}`,
      order_number: depositId,
      callback_url: webhookUrl,
      api_key: secretKey,
      // expire_min: "60", // optional: invoice expires in 60 min
    });

    const plisioRes = await fetch(`${PLISIO_API}/invoices/new?${params.toString()}`);
    const plisioData = await plisioRes.json() as any;

    if (plisioData.status !== "success" || !plisioData.data) {
      console.error("[plisio] Invoice creation failed:", plisioData);
      // Clean up the pending deposit
      db.prepare(`DELETE FROM deposits WHERE id = ?`).run(depositId);
      return res.status(502).json({ error: "Failed to create payment invoice", detail: plisioData.data?.message });
    }

    const invoice = plisioData.data;

    // Update deposit with Plisio info
    db.prepare(`
      UPDATE deposits
      SET plisio_invoice_id = ?, plisio_wallet = ?, crypto_amount = ?
      WHERE id = ?
    `).run(invoice.txn_id, invoice.wallet_hash, Number(invoice.amount), depositId);

    res.json({
      deposit_id: depositId,
      invoice_id: invoice.txn_id,
      wallet_address: invoice.wallet_hash,
      crypto_amount: invoice.amount,
      currency: currency,
      invoice_url: invoice.invoice_url,
      qr_data: invoice.wallet_hash,
      expires_at: invoice.expire_utc
        ? (typeof invoice.expire_utc === "number"
            ? new Date(invoice.expire_utc * 1000).toISOString()
            : String(invoice.expire_utc))
        : new Date(Date.now() + 30 * 60 * 1000).toISOString(), // fallback 30 min
    });
  } catch (err: any) {
    console.error("[plisio] create-invoice error:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
});

/**
 * GET /api/plisio/webhook
 * Health-check: confirms the webhook route is registered.
 */
plisioRouter.get("/webhook", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "Plisio webhook endpoint is active. POST requests only.",
    method: "GET not accepted for webhooks — use POST.",
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/plisio/webhook
 * Called by Plisio when payment status changes.
 * Verifies signature and auto-credits on "completed".
 */
plisioRouter.post("/webhook", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    console.log("[plisio webhook] Received:", JSON.stringify(data));
    console.log("[plisio webhook] Content-Type:", req.headers["content-type"]);

    // Verify signature
    const secretKey = getSecretKey();
    if (!verifyPlisioSignature(data, secretKey)) {
      console.warn("[plisio webhook] Invalid signature");
      return res.status(403).json({ error: "Invalid signature" });
    }

    const orderId = data.order_number; // our deposit ID
    const status = data.status; // new, pending, expired, completed, mismatch, error, cancelled
    const txId = data.txn_id; // Plisio transaction ID
    const confirmations = Number(data.confirmations || 0);

    if (!orderId) {
      return res.status(400).json({ error: "Missing order_number" });
    }

    const dep = db.prepare(`SELECT * FROM deposits WHERE id = ?`).get(orderId) as any;
    if (!dep) {
      console.warn("[plisio webhook] Deposit not found:", orderId);
      return res.status(404).json({ error: "Deposit not found" });
    }

    // Already approved — skip
    if (dep.status === "approved") {
      return res.json({ ok: true, message: "Already credited" });
    }

    // Update confirmations and txid
    db.prepare(`
      UPDATE deposits SET confirmations = ?, txid = ?, plisio_invoice_id = COALESCE(plisio_invoice_id, ?)
      WHERE id = ?
    `).run(confirmations, data.source_txid || null, txId, orderId);

    if (status === "completed" || status === "mismatch") {
      // Auto-credit the user's balance (minus deposit fees from site_settings)
      const creditAmount = Number(dep.amount); // USD amount they requested

      // If mismatch (underpaid/overpaid), use actual received USD
      const actualUsd = status === "mismatch" && data.source_amount
        ? Number(data.source_amount)
        : creditAmount;

      // Fetch deposit fee settings
      let feePercent = 0;
      let feeFlat = 0;
      try {
        const fpRow = db.prepare(`SELECT value FROM site_settings WHERE key = 'deposit_fee_percent'`).get() as any;
        const ffRow = db.prepare(`SELECT value FROM site_settings WHERE key = 'deposit_fee_flat'`).get() as any;
        if (fpRow) feePercent = Number(JSON.parse(fpRow.value)) || 0;
        if (ffRow) feeFlat = Number(JSON.parse(ffRow.value)) || 0;
      } catch { /* use defaults (0) */ }

      const fee = (actualUsd * feePercent / 100) + feeFlat;
      const credited = Math.max(0, actualUsd - fee);

      console.log(`[plisio webhook] Deposit $${actualUsd}, fee $${fee.toFixed(2)} (${feePercent}% + $${feeFlat}), crediting $${credited.toFixed(2)}`);

      db.transaction(() => {
        db.prepare(`
          UPDATE deposits SET status = 'approved', admin_notes = ?, reviewed_at = datetime('now')
          WHERE id = ?
        `).run(`Auto-confirmed via Plisio (${status}, ${confirmations} conf, txid: ${data.source_txid || "n/a"}, fee: $${fee.toFixed(2)})`, orderId);

        db.prepare(`
          UPDATE wallets SET balance = balance + ?, updated_at = datetime('now')
          WHERE user_id = ?
        `).run(credited, dep.user_id);

        db.prepare(`
          INSERT INTO transactions (id, user_id, type, amount, ref_id, meta)
          VALUES (?, ?, 'deposit', ?, ?, ?)
        `).run(
          Array.from(crypto.randomBytes(16)).map(b => b.toString(16).padStart(2, "0")).join(""),
          dep.user_id,
          credited,
          orderId,
          JSON.stringify({ plisio_txn: txId, crypto: dep.crypto_currency, confirmations, source_txid: data.source_txid, gross: actualUsd, fee: fee })
        );
      })();

      console.log(`[plisio webhook] ✅ Auto-credited $${credited.toFixed(2)} (gross $${actualUsd}) to user ${dep.user_id} (deposit ${orderId})`);
    } else if (status === "expired" || status === "cancelled") {
      db.prepare(`UPDATE deposits SET status = 'rejected', admin_notes = ? WHERE id = ?`)
        .run(`Plisio status: ${status}`, orderId);
      console.log(`[plisio webhook] ❌ Deposit ${orderId} ${status}`);
    }
    // For "new", "pending" — just wait

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[plisio webhook] Error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /api/plisio/currencies
 * Returns list of supported cryptocurrencies from Plisio.
 */
plisioRouter.get("/currencies", requireAuth, async (_req: Request, res: Response) => {
  try {
    const secretKey = getSecretKey();
    const resp = await fetch(`${PLISIO_API}/currencies?api_key=${secretKey}`);
    const data = await resp.json() as any;
    if (data.status === "success") {
      // Filter to common ones
      const supported = (data.data || [])
        .filter((c: any) => ["LTC", "BTC", "ETH", "USDT", "TRX", "DOGE", "BNB"].includes(c.cid))
        .map((c: any) => ({ id: c.cid, name: c.name, icon: c.icon, min: c.min_sum_in }));
      return res.json({ currencies: supported });
    }
    res.json({ currencies: [] });
  } catch (err: any) {
    console.error("[plisio] currencies error:", err);
    res.status(500).json({ error: "Failed to fetch currencies" });
  }
});

/**
 * GET /api/plisio/deposit-status/:depositId
 * Check the latest status of a deposit from our DB.
 */
plisioRouter.get("/deposit-status/:depositId", requireAuth, (req: Request, res: Response) => {
  const dep = db.prepare(`SELECT * FROM deposits WHERE id = ? AND user_id = ?`)
    .get(req.params.depositId, req.user!.id) as any;
  if (!dep) return res.status(404).json({ error: "Not found" });
  res.json({
    id: dep.id,
    status: dep.status,
    amount: dep.amount,
    crypto_currency: dep.crypto_currency,
    crypto_amount: dep.crypto_amount,
    wallet: dep.plisio_wallet,
    confirmations: dep.confirmations,
    txid: dep.txid,
    created_at: dep.created_at,
  });
});

/**
 * POST /api/plisio/replay/:depositId
 * Admin-only: re-fetches the invoice status from Plisio and re-runs the
 * crediting logic for a stuck deposit. Safe to call multiple times —
 * already-approved deposits are skipped.
 */
plisioRouter.post("/replay/:depositId", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const dep = db.prepare(`SELECT * FROM deposits WHERE id = ?`).get(req.params.depositId) as any;
    if (!dep) return res.status(404).json({ error: "Deposit not found" });
    if (dep.status === "approved") return res.json({ ok: true, message: "Already approved", deposit_id: dep.id });
    if (!dep.plisio_invoice_id) return res.status(400).json({ error: "No Plisio invoice linked to this deposit" });

    const secretKey = getSecretKey();

    // Fetch current invoice details from Plisio
    const apiRes = await fetch(`${PLISIO_API}/operations/${dep.plisio_invoice_id}?api_key=${secretKey}`);
    const apiData = await apiRes.json() as any;

    if (apiData.status !== "success" || !apiData.data) {
      console.error("[plisio replay] API error:", apiData);
      return res.status(502).json({ error: "Failed to fetch invoice from Plisio", detail: apiData });
    }

    const inv = apiData.data;
    const plisioStatus = inv.status; // completed, mismatch, pending, expired, etc.
    const confirmations = Number(inv.confirmations || 0);
    const sourceTxid = inv.tx_url ? inv.txn_id : null;

    console.log(`[plisio replay] Deposit ${dep.id}: Plisio status=${plisioStatus}, confirmations=${confirmations}`);

    // Update confirmations/txid regardless
    db.prepare(`UPDATE deposits SET confirmations = ?, txid = COALESCE(txid, ?) WHERE id = ?`)
      .run(confirmations, sourceTxid, dep.id);

    if (plisioStatus === "completed" || plisioStatus === "mismatch") {
      const creditAmount = Number(dep.amount);
      const actualUsd = plisioStatus === "mismatch" && inv.source_amount
        ? Number(inv.source_amount)
        : creditAmount;

      // Fetch deposit fee settings
      let feePercent = 0;
      let feeFlat = 0;
      try {
        const fpRow = db.prepare(`SELECT value FROM site_settings WHERE key = 'deposit_fee_percent'`).get() as any;
        const ffRow = db.prepare(`SELECT value FROM site_settings WHERE key = 'deposit_fee_flat'`).get() as any;
        if (fpRow) feePercent = Number(JSON.parse(fpRow.value)) || 0;
        if (ffRow) feeFlat = Number(JSON.parse(ffRow.value)) || 0;
      } catch { /* defaults */ }

      const fee = (actualUsd * feePercent / 100) + feeFlat;
      const credited = Math.max(0, actualUsd - fee);

      db.transaction(() => {
        db.prepare(`
          UPDATE deposits SET status = 'approved', admin_notes = ?, reviewed_at = datetime('now')
          WHERE id = ?
        `).run(`Replayed by admin (${plisioStatus}, ${confirmations} conf, fee: $${fee.toFixed(2)})`, dep.id);

        db.prepare(`UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?`)
          .run(credited, dep.user_id);

        db.prepare(`INSERT INTO transactions (id, user_id, type, amount, ref_id, meta) VALUES (?, ?, 'deposit', ?, ?, ?)`)
          .run(
            Array.from(crypto.randomBytes(16)).map(b => b.toString(16).padStart(2, "0")).join(""),
            dep.user_id, credited, dep.id,
            JSON.stringify({ replayed: true, plisio_status: plisioStatus, gross: actualUsd, fee })
          );
      })();

      console.log(`[plisio replay] ✅ Credited $${credited.toFixed(2)} to user ${dep.user_id}`);
      return res.json({ ok: true, action: "credited", credited, gross: actualUsd, fee, plisio_status: plisioStatus });
    }

    if (plisioStatus === "expired" || plisioStatus === "cancelled") {
      db.prepare(`UPDATE deposits SET status = 'rejected', admin_notes = ? WHERE id = ?`)
        .run(`Replayed: Plisio status ${plisioStatus}`, dep.id);
      return res.json({ ok: true, action: "rejected", plisio_status: plisioStatus });
    }

    // Still pending/new
    return res.json({ ok: true, action: "no_change", plisio_status: plisioStatus, confirmations });
  } catch (err: any) {
    console.error("[plisio replay] Error:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
});

 * Verify Plisio webhook signature.
 * Plisio signs webhooks with HMAC-SHA1 of the JSON body sorted by keys.
 */
function verifyPlisioSignature(data: Record<string, any>, secretKey: string): boolean {
  const receivedSign = data.verify_hash;
  if (!receivedSign) {
    console.warn("[plisio] No verify_hash in webhook data");
    return false;
  }

  // Remove verify_hash from data before computing
  const payload = { ...data };
  delete payload.verify_hash;

  // Plisio signs by sorting keys and concatenating VALUES (not JSON)
  const message = Object.keys(payload)
    .sort()
    .map(key => String(payload[key]))
    .join("");

  const computed = crypto.createHmac("sha1", secretKey).update(message).digest("hex");

  if (computed !== receivedSign) {
    console.warn("[plisio] Signature mismatch. Expected:", receivedSign, "Computed:", computed);
  }

  return computed === receivedSign;
}
