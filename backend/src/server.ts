import "dotenv/config";
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

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true, credentials: true }));
app.use(express.json({ limit: "5mb" }));
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
app.listen(port, () => console.log(`✅ cruzercc API on :${port}`));
