import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.resolve(__dirname, "../sql");

async function run() {
  const files = fs.readdirSync(sqlDir).filter(f => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(sqlDir, f), "utf8");
    console.log(`▶ Applying ${f}…`);
    await pool.query(sql);
    console.log(`✅ ${f} done`);
  }
  await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
