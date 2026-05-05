/**
 * Plisio Poller — periodically checks all pending crypto deposits against
 * the Plisio API and auto-credits / rejects them when their status changes.
 *
 * Runs every 60 seconds by default (configurable via PLISIO_POLL_INTERVAL_MS).
 */

import crypto from "crypto";
import { db } from "../db.js";

const PLISIO_API = "https://plisio.net/api/v1";
const POLL_INTERVAL = Number(process.env.PLISIO_POLL_INTERVAL_MS || 60_000); // default 60s

function getSecretKey(): string | null {
  return process.env.PLISIO_SECRET_KEY || null;
}

function randomId(): string {
  return Array.from(crypto.randomBytes(16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function pollPendingDeposits() {
  const secretKey = getSecretKey();
  if (!secretKey) return; // silently skip if not configured

  const pending = db
    .prepare(
      `SELECT * FROM deposits
       WHERE status = 'pending'
         AND plisio_invoice_id IS NOT NULL
       ORDER BY created_at ASC`
    )
    .all() as any[];

  if (pending.length === 0) return;

  console.log(`[plisio-poller] Checking ${pending.length} pending deposit(s)…`);

  for (const dep of pending) {
    try {
      const res = await fetch(
        `${PLISIO_API}/operations/${dep.plisio_invoice_id}?api_key=${secretKey}`
      );
      const json = (await res.json()) as any;

      if (json.status !== "success" || !json.data) {
        console.warn(
          `[plisio-poller] API error for deposit ${dep.id}:`,
          json
        );
        continue;
      }

      const inv = json.data;
      const plisioStatus: string = inv.status; // completed | mismatch | pending | expired | cancelled | error
      const confirmations = Number(inv.confirmations || 0);
      const sourceTxid = inv.source_txid || inv.txn_id || null;

      // Always update confirmations / txid
      db.prepare(
        `UPDATE deposits SET confirmations = ?, txid = COALESCE(txid, ?) WHERE id = ?`
      ).run(confirmations, sourceTxid, dep.id);

      if (plisioStatus === "completed" || plisioStatus === "mismatch") {
        creditDeposit(dep, plisioStatus, inv, confirmations, sourceTxid);
      } else if (
        plisioStatus === "expired" ||
        plisioStatus === "cancelled" ||
        plisioStatus === "error"
      ) {
        db.prepare(
          `UPDATE deposits SET status = 'rejected', admin_notes = ? WHERE id = ?`
        ).run(`Auto-rejected by poller: Plisio status ${plisioStatus}`, dep.id);
        console.log(
          `[plisio-poller] ❌ Deposit ${dep.id} → ${plisioStatus}`
        );
      }
      // "new" / "pending" → do nothing, check again next cycle
    } catch (err: any) {
      console.error(
        `[plisio-poller] Error checking deposit ${dep.id}:`,
        err.message
      );
    }
  }
}

function creditDeposit(
  dep: any,
  plisioStatus: string,
  inv: any,
  confirmations: number,
  sourceTxid: string | null
) {
  const creditAmount = Number(dep.amount);
  const actualUsd =
    plisioStatus === "mismatch" && inv.source_amount
      ? Number(inv.source_amount)
      : creditAmount;

  // Fetch deposit fee settings
  let feePercent = 0;
  let feeFlat = 0;
  try {
    const fpRow = db
      .prepare(`SELECT value FROM site_settings WHERE key = 'deposit_fee_percent'`)
      .get() as any;
    const ffRow = db
      .prepare(`SELECT value FROM site_settings WHERE key = 'deposit_fee_flat'`)
      .get() as any;
    if (fpRow) feePercent = Number(JSON.parse(fpRow.value)) || 0;
    if (ffRow) feeFlat = Number(JSON.parse(ffRow.value)) || 0;
  } catch {
    /* defaults */
  }

  const fee = (actualUsd * feePercent) / 100 + feeFlat;
  const credited = Math.max(0, actualUsd - fee);

  db.transaction(() => {
    db.prepare(
      `UPDATE deposits
       SET status = 'approved',
           admin_notes = ?,
           reviewed_at = datetime('now')
       WHERE id = ?`
    ).run(
      `Auto-credited by poller (${plisioStatus}, ${confirmations} conf, txid: ${sourceTxid || "n/a"}, fee: $${fee.toFixed(2)})`,
      dep.id
    );

    db.prepare(
      `UPDATE wallets
       SET balance = balance + ?,
           updated_at = datetime('now')
       WHERE user_id = ?`
    ).run(credited, dep.user_id);

    db.prepare(
      `INSERT INTO transactions (id, user_id, type, amount, ref_id, meta)
       VALUES (?, ?, 'deposit', ?, ?, ?)`
    ).run(
      randomId(),
      dep.user_id,
      credited,
      dep.id,
      JSON.stringify({
        poller: true,
        plisio_status: plisioStatus,
        gross: actualUsd,
        fee,
        confirmations,
        source_txid: sourceTxid,
      })
    );
  })();

  console.log(
    `[plisio-poller] ✅ Credited $${credited.toFixed(2)} (gross $${actualUsd}) to user ${dep.user_id} (deposit ${dep.id})`
  );
}

// ── Public API ──────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | null = null;

export function startPlisioPoller() {
  if (timer) return; // already running

  console.log(
    `[plisio-poller] Starting — checking every ${POLL_INTERVAL / 1000}s`
  );

  // Run once immediately, then on interval
  pollPendingDeposits().catch((e) =>
    console.error("[plisio-poller] Initial run error:", e)
  );

  timer = setInterval(() => {
    pollPendingDeposits().catch((e) =>
      console.error("[plisio-poller] Tick error:", e)
    );
  }, POLL_INTERVAL);
}

export function stopPlisioPoller() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[plisio-poller] Stopped");
  }
}
