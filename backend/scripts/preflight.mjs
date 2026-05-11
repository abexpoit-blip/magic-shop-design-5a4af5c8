#!/usr/bin/env node
/**
 * Preflight: refuse to start cruzercc-api if the configured PORT is already
 * bound by another process. Avoids the silent "two apps on 8080" scenario.
 */
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

// Minimal .env loader (no dependency on dotenv at preflight time)
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const [, k, vRaw] = m;
    if (process.env[k] !== undefined) continue;
    let v = vRaw.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "127.0.0.1";
const APP_NAME = "cruzercc-api";

function checkPort(port, host) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", (err) => resolve({ free: false, code: err.code }));
    tester.once("listening", () => {
      tester.close(() => resolve({ free: true }));
    });
    tester.listen(port, host);
  });
}

const result = await checkPort(PORT, HOST);
if (!result.free) {
  console.error("");
  console.error("==================================================================");
  console.error(`[${APP_NAME}] PREFLIGHT FAILED: port ${HOST}:${PORT} is already in use`);
  console.error(`  reason: ${result.code}`);
  console.error("  Refusing to start a second process on the same port.");
  console.error("  Diagnose with:");
  console.error(`    sudo lsof -i :${PORT} -sTCP:LISTEN -n -P`);
  console.error("    pm2 list");
  console.error(`  Then either stop the conflicting app, or change PORT in ${envPath}`);
  console.error("==================================================================");
  console.error("");
  // Exit 1 — combined with PM2 max_restarts this prevents an infinite restart loop.
  process.exit(1);
}

// Port is free — hand off to the real server. Use spawn so the child inherits
// the PM2-managed stdio and signal handling stays clean.
const serverPath = path.join(root, "dist", "server.js");
if (!existsSync(serverPath)) {
  console.error(`[${APP_NAME}] PREFLIGHT FAILED: build artifact missing at ${serverPath}`);
  console.error("  Run: npm run build");
  process.exit(1);
}

const child = spawn(process.execPath, [serverPath], {
  stdio: "inherit",
  env: process.env,
});

const forward = (sig) => () => {
  if (!child.killed) child.kill(sig);
};
process.on("SIGINT", forward("SIGINT"));
process.on("SIGTERM", forward("SIGTERM"));
process.on("SIGHUP", forward("SIGHUP"));

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
