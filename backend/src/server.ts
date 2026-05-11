import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { adminRouter } from "./routes/admin.js";
import { sellerAppsRouter } from "./routes/seller-applications.js";
import { depositsRouter } from "./routes/deposits.js";
import { payoutsRouter } from "./routes/payouts.js";
import { ticketsRouter } from "./routes/tickets.js";
import { announcementsRouter } from "./routes/announcements.js";
import { cardsRouter } from "./routes/cards.js";
import { walletRouter } from "./routes/wallet.js";
import { ordersRouter } from "./routes/orders.js";
import { cartRouter } from "./routes/cart.js";
import { newsRouter } from "./routes/news.js";
import { refundsRouter } from "./routes/refunds.js";
import { siteSettingsRouter } from "./routes/site-settings.js";
import { depositAddressesRouter } from "./routes/deposit-addresses.js";
import { priceRulesRouter } from "./routes/price-rules.js";
import { sellersRouter } from "./routes/sellers.js";
import { plisioRouter } from "./routes/plisio.js";
import { resumePollerIfNeeded } from "./jobs/plisio-poller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN ?? "https://cruzercc.shop,https://www.cruzercc.shop")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function isAllowedOrigin(origin?: string | null) {
  if (!origin) return true;

  try {
    const { hostname } = new URL(origin);
    const host = hostname.toLowerCase();

    return allowedOrigins.has(origin)
      || host === "cruzercc.shop"
      || host === "www.cruzercc.shop"
      || host.endsWith(".lovable.app")
      || host.endsWith(".lovableproject.com");
  } catch {
    return false;
  }
}

const app = express();

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("tiny"));

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Routes
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/admin", adminRouter);
app.use("/api/seller-applications", sellerAppsRouter);
app.use("/api/deposits", depositsRouter);
app.use("/api/payouts", payoutsRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/cards", cardsRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/cart", cartRouter);
app.use("/api/news", newsRouter);
app.use("/api/refunds", refundsRouter);
app.use("/api/site-settings", siteSettingsRouter);
app.use("/api/deposit-addresses", depositAddressesRouter);
app.use("/api/price-rules", priceRulesRouter);
app.use("/api/sellers", sellersRouter);
app.use("/api/plisio", plisioRouter);

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[error]", err);
  const status = err.status ?? (err.issues ? 400 : 500);
  const message = err.issues
    ? err.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join(", ")
    : err.message ?? "Internal error";
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "127.0.0.1";

const server = app.listen(port, host, () => {
  console.log(`✅ cruzercc API listening on ${host}:${port} (pid ${process.pid})`);
  resumePollerIfNeeded();
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error("");
    console.error("==================================================================");
    console.error(`[cruzercc-api] FATAL: port ${host}:${port} already in use (EADDRINUSE)`);
    console.error("  Another process is bound to this port. Refusing to start.");
    console.error("  Diagnose with: sudo lsof -i :" + port + " -sTCP:LISTEN -n -P");
    console.error("==================================================================");
    console.error("");
  } else {
    console.error("[cruzercc-api] FATAL listen error:", err);
  }
  // Exit non-zero; PM2 max_restarts will stop the loop after a few tries.
  process.exit(1);
});

const shutdown = (sig: string) => () => {
  console.log(`[cruzercc-api] received ${sig}, closing server...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on("SIGINT", shutdown("SIGINT"));
process.on("SIGTERM", shutdown("SIGTERM"));
