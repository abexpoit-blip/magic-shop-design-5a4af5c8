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

// Only run SQLite-compatible migration files (005+)
// Files 001-004 are legacy PostgreSQL migrations — skip them
const PG_ONLY_PREFIX = ["001_", "002_", "003_", "004_"];

const files = fs.readdirSync(sqlDir).filter(f => f.endsWith(".sql")).sort();
for (const f of files) {
  if (PG_ONLY_PREFIX.some(p => f.startsWith(p))) {
    console.log(`⏭️  Skipping ${f} (PostgreSQL-only)`);
    continue;
  }
  const sql = fs.readFileSync(path.join(sqlDir, f), "utf8");
  console.log(`▶ Applying ${f}…`);
  try {
    db.exec(sql);
    console.log(`✅ ${f} done`);
  } catch (e: any) {
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
