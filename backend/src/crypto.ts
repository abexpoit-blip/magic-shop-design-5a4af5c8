import crypto from "node:crypto";

const KEY_HEX = process.env.CARD_ENCRYPTION_KEY ?? "";
if (KEY_HEX && KEY_HEX.length !== 64) {
  console.warn("⚠ CARD_ENCRYPTION_KEY must be 64 hex chars (32 bytes).");
}
const KEY = KEY_HEX ? Buffer.from(KEY_HEX, "hex") : null;

export function encryptField(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  if (!KEY) throw new Error("CARD_ENCRYPTION_KEY not configured");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptField(payload: string | null | undefined): string | null {
  if (!payload) return null;
  if (!KEY) throw new Error("CARD_ENCRYPTION_KEY not configured");
  const [v, ivB64, tagB64, dataB64] = payload.split(":");
  if (v !== "v1") throw new Error("Unknown cipher version");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}
