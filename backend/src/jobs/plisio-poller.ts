/**
 * Plisio Poller — event-driven design.
 *
 * NOT always running. Activates only when notifyNewDeposit() is called
 * (i.e. when someone creates a crypto invoice). Keeps polling every 15s
 * while there are pending deposits. Automatically stops when all pending
 * deposits are resolved (approved / rejected).
 *
 * Handles 10-30+ concurrent deposits efficiently — one shared interval
 * checks ALL pending deposits each tick.
 */

import crypto from "crypto";
import { db } from "../db.js";

const PLISIO_API = "https://plisio.net/api/v1";
const POLL_INTERVAL = Number(process.env.PLISIO_POLL_INTERVAL_MS || 15_000); // 15s when active

function getSecretKey(): string | null {
  return process.env.PLISIO_SECRET_KEY || null;
}

function randomId(): string {
  return Array.from(crypto.randomBytes(16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Core polling logic ──────────────────────────────────────

async function pollPendingDeposits(): Promise<number> {
  const secretKey = getSecretKey();
  if (!secretKey) return 0;

  const pending = db
    .prepare(
      `SELECT * FROM deposits
       WHERE status = 'pending'
         AND plisio_invoice_id IS NOT NULL
       ORDER BY created_at ASC`
    )
    .all() as any[];

  if (pending.length === 0) return 0;

  console.log(`[plisio-poller] Checking ${pending.length} pending deposit(s)…`);

  // Process deposits concurrently (max 5 at a time to avoid rate limits)
  const BATCH_SIZE = 5;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map((dep) => checkDeposit(dep, secretKey)));
  }

  // Return how many are still pending after this round
  const remaining = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM deposits
       WHERE status = 'pending' AND plisio_invoice_id IS NOT NULL`
    )
    .get() as any;

  return remaining?.cnt ?? 0;
}

async function checkDeposit(dep: any, secretKey: string) {
  try {
    const res = await fetch(
      `${PLISIO_API}/operations/${dep.plisio_invoice_id}?api_key=${secretKey}`
    );
    const json = (await res.json()) as any;

    if (json.status !== "success" || !json.data) {
      console.warn(`[plisio-poller] API error for deposit ${dep.id}:`, json);
      return;
    }

    const inv = json.data;
    const plisioStatus: string = inv.status;
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
      console.log(`[plisio-poller] ❌ Deposit ${dep.id} → ${plisioStatus}`);
    }
  } catch (err: any) {
    console.error(
      `[plisio-poller] Error checking deposit ${dep.id}:`,
      err.message
    );
  }
}

function creditDeposit(
  dep: any,
  plisioStatus: string,
  inv: any,
  confirmations: number,
  sourceTxid: string | null
) {
  // Skip if already approved (race condition guard)
  const current = db.prepare(`SELECT status FROM deposits WHERE id = ?`).get(dep.id) as any;
  if (current?.status === "approved") return;

  const creditAmount = Number(dep.amount);
  const actualUsd =
    plisioStatus === "mismatch" && inv.source_amount
      ? Number(inv.source_amount)
      : creditAmount;

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
       WHERE id = ? AND status = 'pending'`
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

// ── Public API — event-driven start/stop ────────────────────

let timer: ReturnType<typeof setInterval> | null = null;
let polling = false; // guard against overlapping ticks

async function tick() {
  if (polling) return; // previous tick still running
  polling = true;
  try {
    const remaining = await pollPendingDeposits();
    if (remaining === 0 && timer) {
      clearInterval(timer);
      timer = null;
      console.log("[plisio-poller] ⏸ All deposits resolved — sleeping until next deposit");
    }
  } catch (e: any) {
    console.error("[plisio-poller] Tick error:", e.message);
  } finally {
    polling = false;
  }
}

/**
 * Call this whenever a new crypto deposit is created.
 * If the poller isn't running, it starts. If it's already running, it's a no-op
 * (the existing interval will pick up the new deposit on the next tick).
 */
export function notifyNewDeposit() {
  if (timer) return; // already polling

  console.log(`[plisio-poller] ▶ Activated — polling every ${POLL_INTERVAL / 1000}s`);

  // Run immediately, then on interval
  tick();
  timer = setInterval(tick, POLL_INTERVAL);
}

/**
 * Called at server startup — checks if there are any leftover pending deposits
 * from before restart and resumes polling if needed.
 */
export function resumePollerIfNeeded() {
  const count = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM deposits
       WHERE status = 'pending' AND plisio_invoice_id IS NOT NULL`
    )
    .get() as any;

  if (count?.cnt > 0) {
    console.log(`[plisio-poller] Found ${count.cnt} pending deposit(s) from before restart`);
    notifyNewDeposit();
  } else {
    console.log("[plisio-poller] No pending deposits — sleeping");
  }
}

export function stopPlisioPoller() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[plisio-poller] Stopped");
  }
}
