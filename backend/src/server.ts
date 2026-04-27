import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { sellerAppsRouter } from "./routes/seller-applications.js";
import { adminRouter } from "./routes/admin.js";

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

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[error]", err);
  res.status(err.status ?? 500).json({ error: err.message ?? "Internal error" });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => console.log(`✅ cruzercc API on :${port}`));
