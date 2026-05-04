import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.resolve(__dirname, "../sql");
const dbPath = process.env.DB_PATH || path.resolve(__dirname, "../../data/cruzercc.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

const files = fs.readdirSync(sqlDir).filter(f => f.endsWith(".sql")).sort();
for (const f of files) {
  const sql = fs.readFileSync(path.join(sqlDir, f), "utf8");
  console.log(`▶ Applying ${f}…`);
  try {
    db.exec(sql);
    console.log(`✅ ${f} done`);
  } catch (e: any) {
    // Ignore "already exists" errors for idempotent migrations
    if (e.message?.includes("already exists") || e.message?.includes("duplicate column")) {
      console.log(`⏭️  ${f} skipped (already applied)`);
    } else {
      console.error(`❌ ${f} failed:`, e.message);
      throw e;
    }
  }
}
db.close();
console.log("✅ All migrations complete");
