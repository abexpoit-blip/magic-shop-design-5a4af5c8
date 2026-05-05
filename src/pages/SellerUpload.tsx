import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { cardsApi, priceRulesApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRANDS } from "@/lib/brands";
import { parseAndFormat, dedupe, detectBrand, ParsedCard, toPipeFormat } from "@/lib/cardFormatter";
import { Upload, FileText, Wand2, Trash2, Plus, CheckCircle2, AlertTriangle, Sparkles, Eye, Store, BadgeCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

const countryFlag = (cc: string) => {
  if (!cc || cc.length !== 2) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
};

interface PriceRule {
  id: string; country: string | null; brand: string | null;
  refundable: boolean | null; price: number; priority: number;
}

const SellerUpload = () => {
  const { user } = useAuth();
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedCard[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<Array<{ line: string; row: number; errors: string[] }>>([]);
  const [busy, setBusy] = useState(false);
  const [defaultPrice, setDefaultPrice] = useState("1.50");
  const [refundable, setRefundable] = useState(false);
  const [autoFixOnPublish, setAutoFixOnPublish] = useState(true);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [newRule, setNewRule] = useState({ country: "", brand: "", refundable: "any", price: "" });

  const loadRules = async () => {
    if (!user) return;
    try {
      const { rules: r } = await priceRulesApi.mine();
      setRules((r ?? []) as unknown as PriceRule[]);
    } catch { /* ignore */ }
  };
  useEffect(() => { loadRules(); }, [user]);

  const onFile = async (file: File) => {
    const txt = await file.text();
    setRaw(txt);
    autoFix(txt);
  };

  /** Validate a parsed card and return errors */
  const validateCard = (card: ParsedCard, rowNum: number): string[] => {
    const errors: string[] = [];
    if (card.cc === "null" || card.cc.length < 13 || card.cc.length > 19 || !/^\d+$/.test(card.cc))
      errors.push(`Row ${rowNum}: Invalid CC number (must be 13-19 digits)`);
    if (card.month === "null" || !/^(0[1-9]|1[0-2])$/.test(card.month))
      errors.push(`Row ${rowNum}: Invalid month (must be 01-12)`);
    if (card.year === "null" || !/^\d{2}$/.test(card.year))
      errors.push(`Row ${rowNum}: Invalid year (must be 2-digit)`);
    if (card.cvv === "null" || !/^\d{3,4}$/.test(card.cvv))
      errors.push(`Row ${rowNum}: Missing or invalid CVV (must be 3-4 digits)`);
    return errors;
  };

  const autoFix = (input: string = raw) => {
    const { lines, failed: f } = parseAndFormat(input);
    const { unique, dropped } = dedupe(lines);

    // Validate each parsed card
    const errors: Array<{ line: string; row: number; errors: string[] }> = [];
    const valid: ParsedCard[] = [];
    unique.forEach((card, i) => {
      const cardErrors = validateCard(card, i + 1);
      if (cardErrors.length > 0) {
        errors.push({ line: toPipeFormat(card), row: i + 1, errors: cardErrors });
      } else {
        valid.push(card);
      }
    });

    setParsed(valid);
    setFailed(f);
    setValidationErrors(errors);

    if (dropped > 0) toast.success(`Cleaned ${unique.length} unique cards (removed ${dropped} duplicates)`);
    if (valid.length > 0) toast.success(`${valid.length} cards passed validation`);
    if (errors.length > 0) toast.error(`${errors.length} cards failed validation — check details below`);
    if (f.length > 0) toast.warning(`${f.length} lines could not be parsed at all`);
  };

  const matchPrice = (brand: string, country: string): number => {
    const candidates = rules.filter((r) =>
      (!r.country || r.country.toUpperCase() === country.toUpperCase()) &&
      (!r.brand || r.brand.toUpperCase() === brand.toUpperCase()) &&
      (r.refundable === null || r.refundable === refundable)
    );
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates[0]?.price ?? Number(defaultPrice);
  };

  const nullify = (v: string) => (v === "null" || !v ? null : v);

  const publish = async () => {
    if (!user) return;
    let toPublish = parsed;
    if (autoFixOnPublish) {
      const source = raw.trim() ? raw : parsed.map((p) => Object.values(p).join("|")).join("\n");
      const { lines, failed: f } = parseAndFormat(source);
      const { unique, dropped } = dedupe(lines);
      toPublish = unique;
      setParsed(unique);
      setFailed(f);
      if (dropped > 0 || f.length > 0) {
        toast.message(`Auto-fix swept input: ${unique.length} clean, ${dropped} duplicates, ${f.length} unparseable`);
      }
    }

    if (toPublish.length === 0) { toast.error("Nothing to publish"); return; }
    setBusy(true);

    const rows = toPublish.map((p) => {
      const brand = detectBrand(p.cc);
      const country = p.country !== "null" ? p.country.toUpperCase() : "US";
      return {
        bin: p.cc.slice(0, 6),
        cc_number: p.cc,
        cvv: nullify(p.cvv),
        holder_name: nullify(p.name),
        address: nullify(p.addr),
        phone: nullify(p.tel),
        email: nullify(p.email),
        brand,
        country,
        state: nullify(p.state),
        city: nullify(p.city),
        zip: nullify(p.zip),
        exp_month: nullify(p.month),
        exp_year: nullify(p.year),
        refundable,
        has_phone: p.tel !== "null",
        has_email: p.email !== "null",
        base: `${new Date().toISOString().slice(0, 10).replace(/-/g, "_")}_MIX_${brand}_${refundable ? "REF" : "NON"}_$${matchPrice(brand, country).toFixed(2)}`,
        price: matchPrice(brand, country),
      };
    });

    try {
      const result = await cardsApi.bulkCreate(rows);
      toast.success(`Published ${result.count ?? rows.length} cards`);
      setRaw(""); setParsed([]); setFailed([]);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Publish failed"); }
    finally { setBusy(false); }
  };

  const addRule = async () => {
    if (!user || !newRule.price) return toast.error("Price required");
    try {
      await priceRulesApi.create({
        country: newRule.country || null,
        brand: newRule.brand || null,
        refundable: newRule.refundable === "any" ? null : newRule.refundable === "yes",
        price: Number(newRule.price),
        priority: rules.length,
      });
      setNewRule({ country: "", brand: "", refundable: "any", price: "" });
      loadRules();
      toast.success("Rule added");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const deleteRule = async (id: string) => {
    try { await priceRulesApi.del(id); loadRules(); } catch { /* ignore */ }
  };

  const previewLines = useMemo(() => parsed.slice(0, 10), [parsed]);

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-black neon-text">AUTO-FORMAT UPLOADER</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paste cards in any format — comma, pipe, tab, semicolon. The smart parser auto-detects fields,
            strips labels (Address:, City:, etc.), removes duplicate countries/addresses,
            converts to <code className="text-primary-glow">cc|month/year|cvv|name|addr|city|state|zip|country|tel|email</code>,
            removes duplicates, and applies your price rules.
          </p>
        </div>

        <section className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary-glow" />
            <h2 className="font-display tracking-wider text-primary-glow">PER-CARD PRICING RULES</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Higher-priority rules win. If no rule matches a card, the default price below is used.</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
            <Input placeholder="Country (any)" value={newRule.country} onChange={(e) => setNewRule({ ...newRule, country: e.target.value.toUpperCase() })} className="bg-input/60" />
            <Select value={newRule.brand || "any"} onValueChange={(v) => setNewRule({ ...newRule, brand: v === "any" ? "" : v })}>
              <SelectTrigger className="bg-input/60"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any brand</SelectItem>
                {BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newRule.refundable} onValueChange={(v) => setNewRule({ ...newRule, refundable: v })}>
              <SelectTrigger className="bg-input/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any refundable</SelectItem>
                <SelectItem value="yes">Refundable only</SelectItem>
                <SelectItem value="no">Non-refundable only</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Price USD" type="number" step="0.01" value={newRule.price} onChange={(e) => setNewRule({ ...newRule, price: e.target.value })} className="bg-input/60" />
            <Button onClick={addRule} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-1" />Add rule</Button>
          </div>
          <div className="space-y-1.5">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 border border-border/40 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {r.country ?? "*"} · {r.brand ?? "*"} · {r.refundable === null ? "any" : r.refundable ? "refundable" : "non-ref"}
                  {" → "}<span className="text-primary-glow font-display">${Number(r.price).toFixed(2)}</span>
                </span>
                <button onClick={() => deleteRule(r.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {rules.length === 0 && <p className="text-xs text-muted-foreground">No rules — default price will apply to everything.</p>}
          </div>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Default price ($)</label>
              <Input type="number" step="0.01" value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)} className="bg-input/60 mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Refundable</label>
              <Select value={refundable ? "yes" : "no"} onValueChange={(v) => setRefundable(v === "yes")}>
                <SelectTrigger className="bg-input/60 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">Non-refundable</SelectItem>
                  <SelectItem value="yes">Refundable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="cursor-pointer">
              <input type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              <div className="flex items-center justify-center h-10 px-4 rounded-md border-2 border-dashed border-primary/40 hover:border-primary text-sm text-primary-glow hover:bg-primary/5 transition">
                <FileText className="h-4 w-4 mr-2" />Drop .txt / .csv file
              </div>
            </label>
          </div>
          <label className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/40 cursor-pointer hover:bg-secondary/50 transition">
            <input type="checkbox" checked={autoFixOnPublish} onChange={(e) => setAutoFixOnPublish(e.target.checked)} className="mt-0.5 accent-primary cursor-pointer" />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-display tracking-wider text-primary-glow">
                <Wand2 className="h-3.5 w-3.5" /> AUTO-FIX BEFORE PUBLISH
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Re-runs the format fixer + dedupe right before saving.</p>
            </div>
          </label>
        </section>

        <section className="glass-neon rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display tracking-wider text-primary-glow">PASTE CARDS</h2>
            <Button onClick={() => autoFix()} variant="outline" className="border-primary/40 text-primary-glow">
              <Wand2 className="h-4 w-4 mr-2" />Auto-fix format
            </Button>
          </div>
          <Textarea rows={10} value={raw} onChange={(e) => setRaw(e.target.value)}
            placeholder={`Any of these works:\n4111111111111111|12|28|123|John Smith|123 Main St|New York|NY|10001|US|+15555551234|john@x.com`}
            className="bg-input/60 font-mono text-xs" />
        </section>

        {parsed.length > 0 && (
          <section className="glass rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h2 className="font-display tracking-wider text-success">{parsed.length} CARDS READY</h2>
              </div>
              <Button onClick={publish} disabled={busy} className="bg-gradient-primary shadow-neon">
                <Upload className="h-4 w-4 mr-2" />{busy ? "Publishing…" : `Publish ${parsed.length} cards`}
              </Button>
            </div>
            <div className="rounded-lg bg-background/40 p-3 max-h-72 overflow-auto">
              <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
                {previewLines.map((c) => Object.values(c).join("|")).join("\n")}
                {parsed.length > 10 && `\n… and ${parsed.length - 10} more`}
              </pre>
            </div>
          </section>
        )}

        {validationErrors.length > 0 && (
          <section className="glass rounded-2xl p-6 border border-destructive/30">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="h-5 w-5 text-destructive" />
              <h3 className="font-display tracking-wider text-destructive">{validationErrors.length} CARDS FAILED VALIDATION</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Expected format: <code className="text-primary-glow">cc|month/year|cvv|name|addr|city|state|zip|country|tel|email</code>
            </p>
            <div className="space-y-2 max-h-60 overflow-auto">
              {validationErrors.map((ve, i) => (
                <div key={i} className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                  <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap mb-1">{ve.line}</pre>
                  {ve.errors.map((err, j) => (
                    <p key={j} className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" /> {err}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {failed.length > 0 && (
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h3 className="font-display tracking-wider text-warning">{failed.length} UNPARSEABLE LINES</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-2">These lines couldn't be parsed into any card format at all.</p>
            <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">
              {failed.join("\n")}
            </pre>
          </section>
        )}
      </div>
    </AppShell>
  );
};

export default SellerUpload;
