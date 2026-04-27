import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRANDS } from "@/lib/brands";
import { parseAndFormat, dedupe, detectBrand, ParsedCard } from "@/lib/cardFormatter";
import { Upload, FileText, Wand2, Trash2, Plus, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface PriceRule {
  id: string; country: string | null; brand: string | null;
  refundable: boolean | null; price: number; priority: number;
}

const SellerUpload = () => {
  const { user } = useAuth();
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedCard[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [defaultPrice, setDefaultPrice] = useState("1.50");
  const [refundable, setRefundable] = useState(false);
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [newRule, setNewRule] = useState({ country: "", brand: "", refundable: "any", price: "" });

  const loadRules = async () => {
    if (!user) return;
    const { data } = await supabase.from("price_rules" as never).select("*").eq("seller_id", user.id).order("priority", { ascending: false });
    setRules((data ?? []) as unknown as PriceRule[]);
  };
  useEffect(() => { loadRules(); /* eslint-disable-next-line */ }, [user]);

  const onFile = async (file: File) => {
    const txt = await file.text();
    setRaw(txt);
    autoFix(txt);
  };

  const autoFix = (input: string = raw) => {
    const { lines, failed: f } = parseAndFormat(input);
    const { unique, dropped } = dedupe(lines);
    setParsed(unique);
    setFailed(f);
    if (dropped > 0) toast.success(`Cleaned ${unique.length} unique cards (removed ${dropped} duplicates)`);
    else if (unique.length > 0) toast.success(`Parsed ${unique.length} cards`);
    if (f.length > 0) toast.warning(`${f.length} lines could not be parsed`);
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

  const publish = async () => {
    if (!user || parsed.length === 0) return;
    setBusy(true);

    // Dedupe against existing stock by cc_number
    const numbers = parsed.map((p) => p.cc);
    const { data: existing } = await supabase.from("cards").select("cc_number").in("cc_number", numbers);
    const existingSet = new Set((existing ?? []).map((c: { cc_number: string | null }) => c.cc_number));
    const fresh = parsed.filter((p) => !existingSet.has(p.cc));
    const skipped = parsed.length - fresh.length;

    const rows = fresh.map((p) => {
      const brand = detectBrand(p.cc);
      const country = p.country !== "null" ? p.country.toUpperCase() : "US";
      return {
        seller_id: user.id,
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

    if (rows.length === 0) {
      toast.warning(`All ${parsed.length} cards are already in stock`);
      setBusy(false); return;
    }

    const { error } = await supabase.from("cards").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Published ${rows.length} cards${skipped > 0 ? ` (${skipped} duplicates skipped)` : ""}`);
    setRaw(""); setParsed([]); setFailed([]);
  };

  const addRule = async () => {
    if (!user || !newRule.price) return toast.error("Price required");
    const { error } = await (supabase.from("price_rules" as never) as any).insert({
      seller_id: user.id,
      country: newRule.country || null,
      brand: newRule.brand || null,
      refundable: newRule.refundable === "any" ? null : newRule.refundable === "yes",
      price: Number(newRule.price),
      priority: rules.length,
    });
    if (error) return toast.error(error.message);
    setNewRule({ country: "", brand: "", refundable: "any", price: "" });
    loadRules();
    toast.success("Rule added");
  };

  const deleteRule = async (id: string) => {
    await supabase.from("price_rules" as never).delete().eq("id", id);
    loadRules();
  };

  const previewLines = useMemo(() => parsed.slice(0, 10), [parsed]);

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-black neon-text">AUTO-FORMAT UPLOADER</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paste cards in any format — comma, pipe, tab, semicolon. The parser auto-detects fields,
            converts to <code className="text-primary-glow">cc|month|year|cvv|name|addr|city|state|zip|country|tel|email</code>,
            removes duplicates, and applies your price rules.
          </p>
        </div>

        {/* Pricing rules */}
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

        {/* Default settings */}
        <section className="glass rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
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
        </section>

        {/* Paste box */}
        <section className="glass-neon rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display tracking-wider text-primary-glow">PASTE CARDS</h2>
            <Button onClick={() => autoFix()} variant="outline" className="border-primary/40 text-primary-glow">
              <Wand2 className="h-4 w-4 mr-2" />Auto-fix format
            </Button>
          </div>
          <Textarea rows={10} value={raw} onChange={(e) => setRaw(e.target.value)}
            placeholder={`Any of these works:\n4111111111111111|12|28|123|John Smith|123 Main St|New York|NY|10001|US|+15555551234|john@x.com\n4111111111111111,12/28,123,John Smith,123 Main St,New York,NY,10001,US,5555551234,john@x.com\n4111111111111111\t12\t28\t123\tJohn Smith\t...`}
            className="bg-input/60 font-mono text-xs" />
        </section>

        {/* Preview */}
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

        {failed.length > 0 && (
          <section className="glass rounded-2xl p-6 border border-warning/40 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <h2 className="font-display tracking-wider text-warning">{failed.length} LINES SKIPPED</h2>
            </div>
            <p className="text-xs text-muted-foreground">These couldn't be parsed — check the format and re-paste.</p>
            <pre className="text-[11px] font-mono text-muted-foreground bg-background/40 p-3 rounded max-h-40 overflow-auto whitespace-pre-wrap">
              {failed.slice(0, 20).join("\n")}
              {failed.length > 20 && `\n… and ${failed.length - 20} more`}
            </pre>
          </section>
        )}
      </div>
    </AppShell>
  );
};

const nullify = (v: string) => (v === "null" || !v ? null : v);

export default SellerUpload;
