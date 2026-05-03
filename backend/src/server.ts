import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { sellerAppsRouter } from "./routes/seller-applications.js";
import { adminRouter } from "./routes/admin.js";
import { cardsRouter } from "./routes/cards.js";
import { cartRouter } from "./routes/cart.js";
import { ordersRouter } from "./routes/orders.js";
import { walletRouter } from "./routes/wallet.js";
import { depositsRouter } from "./routes/deposits.js";
import { payoutsRouter } from "./routes/payouts.js";
import { ticketsRouter } from "./routes/tickets.js";
import { announcementsRouter } from "./routes/announcements.js";
import { siteSettingsRouter } from "./routes/site-settings.js";
import { refundsRouter } from "./routes/refunds.js";
import { newsRouter } from "./routes/news.js";
import { priceRulesRouter } from "./routes/price-rules.js";
import { depositAddressesRouter } from "./routes/deposit-addresses.js";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./openapi.js";
import { listRoutes } from "./routes-introspect.js";
import { requireAuth, requireRole } from "./auth-middleware.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("tiny"));

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/seller-applications", sellerAppsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/cards", cardsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/deposits", depositsRouter);
app.use("/api/payouts", payoutsRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/site-settings", siteSettingsRouter);
app.use("/api/refunds", refundsRouter);
app.use("/api/news", newsRouter);
app.use("/api/price-rules", priceRulesRouter);
app.use("/api/deposit-addresses", depositAddressesRouter);

// Swagger / OpenAPI docs.
// Use a dedicated CSP for the docs route — Swagger UI needs inline scripts/styles.
app.get("/api/docs.json", (_req, res) => res.json(openapiSpec));
app.use(
  "/api/docs",
  (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    // strip the global helmet CSP for this subtree
    req.res?.removeHeader("Content-Security-Policy");
    next();
  },
  swaggerUi.serveFiles(openapiSpec as any),
  swaggerUi.setup(openapiSpec as any, {
    customSiteTitle: "cruzercc API docs",
  })
);

// Admin-only live route introspection. Confirms which routers are mounted.
app.get(
  "/api/admin/routes",
  requireAuth,
  requireRole("admin"),
  (_req, res) => res.json(listRoutes(app))
);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[error]", err);
  res.status(err.status ?? 500).json({ error: err.message ?? "Internal error" });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => console.log(`✅ cruzercc API on :${port}`));
