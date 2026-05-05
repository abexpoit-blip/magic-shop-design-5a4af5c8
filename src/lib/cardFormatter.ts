// Auto-formats messy card lines into the canonical pipe format:
// cc|month/year|cvv|name|addr|city|state|zip|country|tel|email
// Missing fields are emitted as the literal "null".

export type ParsedCard = {
  cc: string; month: string; year: string; cvv: string;
  name: string; addr: string; city: string; state: string;
  zip: string; country: string; tel: string; email: string;
};

const NULLISH = new Set(["", "null", "n/a", "na", "none", "-", "undefined"]);
const norm = (s: string) => (NULLISH.has(s.trim().toLowerCase()) ? "null" : s.trim());

const isCC = (s: string) => /^\d{12,19}$/.test(s.replace(/\s|-/g, ""));
const isCVV = (s: string) => /^\d{3,4}$/.test(s);
const isMonth = (s: string) => /^(0?[1-9]|1[0-2])$/.test(s);
const isYear = (s: string) => /^(\d{2}|20\d{2})$/.test(s);
const isMMYY = (s: string) => /^(0?[1-9]|1[0-2])\s*[\/\-]\s*(\d{2}|20\d{2})$/.test(s);
const isZip = (s: string) => /^[A-Z0-9][A-Z0-9\s-]{2,9}$/i.test(s);
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isPhone = (s: string) => /^[+()\d][\d\s\-().]{6,}$/.test(s) && /\d{6,}/.test(s.replace(/\D/g, ""));
const isCountry2 = (s: string) => /^[A-Z]{2}$/.test(s);
const isCountryFull = (s: string) => /^[A-Za-z\s]{4,30}$/.test(s) && !/\d/.test(s);

export function detectBrand(cc: string): string {
  const n = cc.replace(/\D/g, "");
  if (/^4/.test(n)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "MASTERCARD";
  if (/^3[47]/.test(n)) return "AMEX";
  if (/^6(011|5|4[4-9])/.test(n)) return "DISCOVER";
  if (/^35/.test(n)) return "JCB";
  if (/^3(0[0-5]|[68])/.test(n)) return "DINERS";
  return "OTHER";
}

/** Strip common label prefixes like "Address:", "City:", etc. */
function stripLabel(s: string): string {
  return s.replace(/^(address|addr|city|state|zip|zipcode|country|phone|tel|email|name|holder)\s*:\s*/i, "").trim();
}

/** Split a single line by the most likely delimiter. */
function splitLine(line: string): string[] {
  for (const d of ["|", "\t", ";", ","]) {
    if (line.includes(d)) {
      return line.split(d).map((s) => stripLabel(s.trim()));
    }
  }
  return line.trim().split(/\s{2,}/).map((s) => stripLabel(s.trim()));
}

/**
 * Smart parser that handles:
 * - Standard format: cc|month|year|cvv|name|addr|city|state|zip|country|tel|email
 * - Labeled fields: "Address: 123 Main St", "City: Boston"
 * - Duplicate fields (e.g. double country, double address) — takes first occurrence
 * - Base/price prefixes stripped automatically
 * - MM/YY combined expiry fields
 */
/**
 * Remove duplicate consecutive field blocks.
 * E.g. cc|mm|yy|cvv|name|addr|city|state|zip|country|addr|city|state|zip|country|tel|email
 * The duplicated addr..country block is removed, keeping the first occurrence.
 */
function deduplicateFields(parts: string[]): string[] {
  // Find the CC index to know where data fields start
  const ccIdx = parts.findIndex((p) => isCC(p.replace(/\s|-/g, "")));
  if (ccIdx === -1) return parts;

  // Fields after cc/month/year/cvv/name start at ccIdx+5
  const dataStart = ccIdx + 5;
  if (dataStart >= parts.length) return parts;

  const dataFields = parts.slice(dataStart);
  // Look for a repeated subsequence: try window sizes 3-6
  for (let winSize = 3; winSize <= 6; winSize++) {
    if (dataFields.length < winSize * 2) continue;
    // Check if fields [0..winSize-1] repeat at [winSize..2*winSize-1]
    for (let start = 0; start <= dataFields.length - winSize * 2; start++) {
      let match = true;
      for (let k = 0; k < winSize; k++) {
        if (dataFields[start + k].toLowerCase() !== dataFields[start + winSize + k].toLowerCase()) {
          match = false;
          break;
        }
      }
      if (match) {
        // Remove the duplicate block
        const newData = [...dataFields.slice(0, start + winSize), ...dataFields.slice(start + winSize * 2)];
        return [...parts.slice(0, dataStart), ...newData];
      }
    }
  }
  return parts;
}

export function parseCardLine(raw: string): ParsedCard | null {
  const line = raw.trim();
  if (!line) return null;

  // Skip header lines
  if (/^(base|cc|card|number)\b/i.test(line)) return null;

  let parts = splitLine(line).filter((p) => p.length > 0);
  if (parts.length === 0) return null;

  // Handle prefix format: base|prices|cc|month|year|cvv|...
  if (parts.length >= 3 && /[_$]/.test(parts[0]) && !isCC(parts[0].replace(/\s|-/g, ""))) {
    const maybePrice = parts[1];
    if (/^\$?\d+(\.\d+)?$/.test(maybePrice)) {
      parts = parts.slice(2);
    } else {
      parts = parts.slice(1);
    }
  }

  // Remove trailing price field(s)
  while (parts.length > 0) {
    const lastField = parts[parts.length - 1];
    if (lastField && /^\$?\d+(\.\d+)?\$?$/.test(lastField)) {
      parts = parts.slice(0, -1);
    } else break;
  }

  // Deduplicate: when input has labeled + unlabeled duplicate fields
  // (e.g. "Address: 123 Main|City: Denver|...|123 Main|Denver|...")
  // detect the repeated block and remove it.
  if (parts.length > 13) {
    parts = deduplicateFields(parts);
  }

  const out: ParsedCard = {
    cc: "null", month: "null", year: "null", cvv: "null",
    name: "null", addr: "null", city: "null", state: "null",
    zip: "null", country: "null", tel: "null", email: "null",
  };

  // Fast path: already in canonical order (12+ fields starting with cc, month, year)
  if (parts.length >= 12 && isCC(parts[0]) && isMonth(parts[1]) && isYear(parts[2])) {
    return {
      cc: norm(parts[0].replace(/\s|-/g, "")),
      month: norm(parts[1].padStart(2, "0")),
      year: norm(parts[2].length === 4 ? parts[2].slice(2) : parts[2]),
      cvv: norm(parts[3] ?? "null"),
      name: norm(parts[4] ?? "null"),
      addr: norm(parts[5] ?? "null"),
      city: norm(parts[6] ?? "null"),
      state: norm(parts[7] ?? "null"),
      zip: norm(parts[8] ?? "null"),
      country: norm(parts[9] ?? "null"),
      tel: norm(parts[10] ?? "null"),
      email: norm(parts[11] ?? "null"),
    };
  }

  // Fast path: cc|MM/YY|cvv|name|addr|city|state|zip|country|tel|email (11 fields with combined expiry)
  if (parts.length >= 11 && isCC(parts[0]) && isMMYY(parts[1])) {
    const [mm, yy] = parts[1].split(/[\/\-]/);
    return {
      cc: norm(parts[0].replace(/\s|-/g, "")),
      month: norm(mm.padStart(2, "0")),
      year: norm(yy.length === 4 ? yy.slice(2) : yy),
      cvv: norm(parts[2] ?? "null"),
      name: norm(parts[3] ?? "null"),
      addr: norm(parts[4] ?? "null"),
      city: norm(parts[5] ?? "null"),
      state: norm(parts[6] ?? "null"),
      zip: norm(parts[7] ?? "null"),
      country: norm(parts[8] ?? "null"),
      tel: norm(parts[9] ?? "null"),
      email: norm(parts[10] ?? "null"),
    };
  }

  const used = new Set<number>();
  const take = (i: number, val: string) => { used.add(i); return norm(val); };

  // 1. Credit card number
  const ccIdx = parts.findIndex((p) => isCC(p.replace(/\s|-/g, "")));
  if (ccIdx === -1) return null;
  out.cc = take(ccIdx, parts[ccIdx].replace(/\s|-/g, ""));

  // 2. Month / year — check for MM/YY combo at next index, else two separate
  const next = parts[ccIdx + 1];
  if (next && isMMYY(next)) {
    const [mm, yy] = next.split(/[\/\-]/);
    out.month = take(ccIdx + 1, mm.padStart(2, "0"));
    out.year = yy.length === 4 ? yy.slice(2) : yy;
  } else {
    const mIdx = parts.findIndex((p, i) => !used.has(i) && i > ccIdx && isMonth(p));
    if (mIdx !== -1) out.month = take(mIdx, parts[mIdx].padStart(2, "0"));
    const yIdx = parts.findIndex((p, i) => !used.has(i) && i > ccIdx && isYear(p));
    if (yIdx !== -1) {
      const y = parts[yIdx];
      out.year = take(yIdx, y.length === 4 ? y.slice(2) : y);
    }
  }

  // 3. CVV — first 3-4 digit chunk after CC that isn't month/year
  const cvvIdx = parts.findIndex((p, i) => !used.has(i) && i > ccIdx && isCVV(p));
  if (cvvIdx !== -1) out.cvv = take(cvvIdx, parts[cvvIdx]);

  // 4. Email
  const emIdx = parts.findIndex((p, i) => !used.has(i) && isEmail(p));
  if (emIdx !== -1) out.email = take(emIdx, parts[emIdx]);

  // 5. Phone
  const telIdx = parts.findIndex((p, i) => !used.has(i) && isPhone(p));
  if (telIdx !== -1) out.tel = take(telIdx, parts[telIdx]);

  // 6. Country — prefer 2-letter code, then full country name (take FIRST occurrence only)
  const ctIdx = parts.findIndex((p, i) => !used.has(i) && isCountry2(p.toUpperCase()));
  if (ctIdx !== -1) {
    out.country = take(ctIdx, parts[ctIdx].toUpperCase());
    // Mark any duplicate country fields as used so they're skipped
    parts.forEach((p, i) => {
      if (!used.has(i) && (isCountry2(p.toUpperCase()) || p.toUpperCase() === out.country)) {
        used.add(i);
      }
    });
  } else {
    // Try full country name — find first match, mark duplicates
    const fullCtIdx = parts.findIndex((p, i) => !used.has(i) && isCountryFull(p) && p.length >= 4);
    if (fullCtIdx !== -1) {
      const countryVal = parts[fullCtIdx].toUpperCase();
      out.country = take(fullCtIdx, parts[fullCtIdx]);
      // Mark duplicates
      parts.forEach((p, i) => {
        if (!used.has(i) && p.toUpperCase() === countryVal) {
          used.add(i);
        }
      });
    }
  }

  // 7. Remaining tokens: name, addr, city, state, zip in order
  const remaining = parts.map((p, i) => ({ p, i })).filter(({ i }) => !used.has(i));

  // ZIP — short alphanumeric 3-10 chars, prefer ones with digits
  const zipPick = remaining.find(({ p }) => isZip(p) && /\d/.test(p) && p.length <= 10);
  if (zipPick) { out.zip = take(zipPick.i, zipPick.p); }

  const rest = remaining.filter(({ i }) => !used.has(i));

  // Name = first remaining with letters and spaces (likely "John Smith")
  const nameIdx = rest.findIndex(({ p }) => /^[A-Za-z][A-Za-z\s.'-]{2,}$/.test(p) && p.includes(" "));
  if (nameIdx !== -1) {
    const item = rest[nameIdx]; out.name = take(item.i, item.p); rest.splice(nameIdx, 1);
  } else if (rest.length > 0 && /^[A-Za-z]/.test(rest[0].p)) {
    const item = rest.shift()!; out.name = take(item.i, item.p);
  }

  // Address = next remaining with digits + letters (likely "123 Main St")
  const addrIdx = rest.findIndex(({ p }) => /\d/.test(p) && /[A-Za-z]/.test(p) && p.length > 5);
  if (addrIdx !== -1) {
    const item = rest[addrIdx]; out.addr = take(item.i, item.p); rest.splice(addrIdx, 1);
    // Mark duplicate address fields
    rest.forEach((r, ri) => {
      if (!used.has(r.i) && r.p === item.p) { used.add(r.i); rest.splice(ri, 1); }
    });
  } else if (rest.length > 0) {
    const item = rest.shift()!; out.addr = take(item.i, item.p);
  }

  // State = short upper (2-3 letters)
  const stIdx = rest.findIndex(({ p }) => /^[A-Z]{2,3}$/.test(p));
  if (stIdx !== -1) {
    const item = rest[stIdx]; out.state = take(item.i, item.p); rest.splice(stIdx, 1);
  }

  // City = first remaining string-only token
  const cityIdx = rest.findIndex(({ p }) => /^[A-Za-z][A-Za-z\s.'-]+$/.test(p));
  if (cityIdx !== -1) {
    const item = rest[cityIdx]; out.city = take(item.i, item.p); rest.splice(cityIdx, 1);
  } else if (rest.length > 0) {
    const item = rest.shift()!; out.city = take(item.i, item.p);
  }

  // If state is still null and city was set, fall back: scan unused for 2-letter
  if (out.state === "null") {
    const fallback = rest.find(({ p }) => /^[A-Za-z]{2,3}$/.test(p));
    if (fallback) out.state = take(fallback.i, fallback.p);
  }

  return out;
}

/** Output in upload/fixer format: cc|month/year|cvv|name|addr|city|state|zip|country|tel|email */
export function toPipeFormat(card: ParsedCard): string {
  const expiry = `${card.month}/${card.year}`;
  return `${card.cc}|${expiry}|${card.cvv}|${card.name}|${card.addr}|${card.city}|${card.state}|${card.zip}|${card.country}|${card.tel}|${card.email}`;
}

export function parseAndFormat(input: string): { lines: ParsedCard[]; output: string; failed: string[] } {
  const lines: ParsedCard[] = [];
  const failed: string[] = [];
  for (const raw of input.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const parsed = parseCardLine(raw);
    if (parsed && parsed.cc !== "null") lines.push(parsed);
    else failed.push(raw);
  }
  return { lines, output: lines.map(toPipeFormat).join("\n"), failed };
}

/** Dedupe by full card number. */
export function dedupe(cards: ParsedCard[]): { unique: ParsedCard[]; dropped: number } {
  const seen = new Set<string>();
  const unique: ParsedCard[] = [];
  for (const c of cards) {
    if (seen.has(c.cc)) continue;
    seen.add(c.cc);
    unique.push(c);
  }
  return { unique, dropped: cards.length - unique.length };
}
