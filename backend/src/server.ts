import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";

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
