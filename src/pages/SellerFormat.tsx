import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseAndFormat, dedupe, toPipeFormat, detectBrand, ParsedCard } from "@/lib/cardFormatter";
import { Wand2, Copy, Download, FileText, Trash2, AlertTriangle, CheckCircle2, ArrowRight, Upload, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/lib/brands";

const TEMPLATE = "cc|month|year|cvv|name|addr|city|state|zip|country|tel|email";

const SAMPLE = `4111 1111 1111 1111, 12/28, 123, John Smith, 123 Main St, New York, NY, 10001, US, +1 555 555 1234, john@example.com
5555-5555-5555-4444;05;27;456;Maria Lopez;500 Oak Ave;Miami;FL;33101;US;5557779999;maria@x.io
378282246310005\t11\t2026\t9876\tAlex Doe\t77 King Rd\tLondon\tEN\tSW1A1AA\tGB\t+44 20 7946 0958\talex@uk.co
6011000990139424|02|29|321|Anna Liu|22 Wuhua Rd|Shanghai|SH|200000|CN|null|null`;

const SellerFormat = () => {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedCard[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [dropDuplicates, setDropDuplicates] = useState(true);
  const [dedupedCount, setDedupedCount] = useState(0);
  const [hasRun, setHasRun] = useState(false);

  const onFile = async (file: File) => {
    const txt = await file.text();
    setRaw(txt);
    runFix(txt);
  };

  const runFix = (input: string = raw) => {
    if (!input.trim()) {
      toast.error("Paste card data first");
      return;
    }
    const { lines, failed: f } = parseAndFormat(input);
    let final = lines;
    let dropped = 0;
    if (dropDuplicates) {
      const r = dedupe(lines);
      final = r.unique;
      dropped = r.dropped;
    }
    setParsed(final);
    setFailed(f);
    setDedupedCount(dropped);
    setHasRun(true);
    if (final.length > 0) {
      toast.success(`Formatted ${final.length} card${final.length === 1 ? "" : "s"}${dropped ? ` · ${dropped} duplicate${dropped === 1 ? "" : "s"} removed` : ""}`);
    }
    if (f.length > 0) {
      toast.warning(`${f.length} line${f.length === 1 ? "" : "s"} could not be parsed`);
    }
  };

  const output = useMemo(() => parsed.map(toPipeFormat).join("\n"), [parsed]);
  const maskedOutput = useMemo(
    () => parsed.map((card) => `${maskCardNumber(card.cc)}|${card.month}|${card.year}|***|${card.name}|${card.addr}|${card.city}|${card.state}|${card.zip}|${card.country}|${card.tel}|${card.email}`).join("\n"),
    [parsed],
  );

  const stats = useMemo(() => {
    const brands: Record<string, number> = {};
    const countries: Record<string, number> = {};
    let withEmail = 0;
    let withPhone = 0;
    parsed.forEach((c) => {
      const brand = detectBrand(c.cc);
      brands[brand] = (brands[brand] ?? 0) + 1;
      const ct = c.country !== "null" ? c.country : "??";
      countries[ct] = (countries[ct] ?? 0) + 1;
      if (c.email !== "null") withEmail++;
      if (c.tel !== "null") withPhone++;
    });
    return { brands, countries, withEmail, withPhone };
  }, [parsed]);

  const copyOutput = async () => {
    if (!output) return toast.error("Nothing to copy");
    await navigator.clipboard.writeText(output);
    toast.success(`Copied ${parsed.length} cards to clipboard`);
  };

  const downloadOutput = () => {
    if (!output) return toast.error("Nothing to download");
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `formatted-cards-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  const reset = () => {
    setRaw(""); setParsed([]); setFailed([]); setDedupedCount(0); setHasRun(false);
  };

  const loadSample = () => {
    setRaw(SAMPLE);
    runFix(SAMPLE);
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-black neon-text">CARD FORMAT FIXER</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Paste mixed-format cards → get clean shop-ready lines.
              Output: <code className="text-primary-glow">{TEMPLATE}</code>
            </p>
          </div>
          <Link to="/seller/upload">
            <Button variant="outline" className="border-primary/40 text-primary-glow">
              <Upload className="h-4 w-4 mr-2" />Go to publisher
            </Button>
          </Link>
        </div>

        {/* HOW IT WORKS */}
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary-glow" />
            <h2 className="font-display tracking-wider text-primary-glow text-sm">HOW IT FIXES YOUR DATA</h2>
          </div>
          <ul className="text-xs text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-1.5">
            <li>• Auto-detects delimiter: pipe <code>|</code>, comma <code>,</code>, tab, or semicolon</li>
            <li>• Strips spaces / dashes from card numbers</li>
            <li>• Splits MM/YY combos into separate month + year</li>
            <li>• Pads month to 2 digits, trims year to 2 digits</li>
            <li>• Identifies email, phone, ZIP, 2-letter country anywhere on the line</li>
            <li>• Maps remaining tokens → name, address, city, state</li>
            <li>• Replaces missing fields with literal <code>null</code></li>
            <li>• Removes duplicate card numbers (toggleable)</li>
          </ul>
        </section>

        {/* INPUT */}
        <section className="glass-neon rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-display tracking-wider text-primary-glow">PASTE MIXED-FORMAT CARDS</h2>
            <div className="flex gap-2 flex-wrap">
              <label className="cursor-pointer">
                <input type="file" accept=".txt,.csv,.tsv" className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                <div className="flex items-center justify-center h-9 px-3 rounded-md border border-primary/40 hover:border-primary text-xs text-primary-glow hover:bg-primary/5 transition">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />Open file
                </div>
              </label>
              <Button size="sm" variant="outline" onClick={loadSample}>Load sample</Button>
              <Button size="sm" variant="outline" onClick={reset}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />Clear
              </Button>
            </div>
          </div>

          <Textarea rows={10} value={raw} onChange={(e) => setRaw(e.target.value)}
            placeholder={`Examples that all work:\n4111111111111111|12|28|123|John Smith|...\n4111 1111 1111 1111, 12/28, 123, John Smith, ...\n4111111111111111\\t12\\t28\\t123\\tJohn Smith\\t...`}
            className="bg-input/60 font-mono text-xs" />

          <div className="flex items-center justify-between flex-wrap gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={dropDuplicates} onChange={(e) => setDropDuplicates(e.target.checked)}
                className="accent-primary cursor-pointer" />
              Remove duplicate card numbers
            </label>
            <div className="flex gap-2">
              {hasRun && (
                <Button variant="outline" onClick={() => runFix()} className="border-border/60">
                  <RefreshCw className="h-4 w-4 mr-2" />Re-run
                </Button>
              )}
              <Button onClick={() => runFix()} className="bg-gradient-primary shadow-neon">
                <Wand2 className="h-4 w-4 mr-2" />Auto-fix format
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </section>

        {/* RESULT */}
        {hasRun && (
          <section className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {parsed.length > 0
                  ? <CheckCircle2 className="h-5 w-5 text-success" />
                  : <AlertTriangle className="h-5 w-5 text-warning" />}
                <h2 className="font-display tracking-wider text-primary-glow">
                  {parsed.length} CLEAN LINE{parsed.length === 1 ? "" : "S"}
                  {dedupedCount > 0 && <span className="text-xs text-muted-foreground ml-2">· {dedupedCount} duplicate{dedupedCount === 1 ? "" : "s"} removed</span>}
                  {failed.length > 0 && <span className="text-xs text-warning ml-2">· {failed.length} skipped</span>}
                </h2>
              </div>
              <div className="flex gap-2">
                <Button onClick={copyOutput} disabled={!output} variant="outline" className="border-primary/40 text-primary-glow">
                  <Copy className="h-4 w-4 mr-2" />Copy all
                </Button>
                <Button onClick={downloadOutput} disabled={!output} variant="outline" className="border-primary/40 text-primary-glow">
                  <Download className="h-4 w-4 mr-2" />Download .txt
                </Button>
              </div>
            </div>

            {parsed.length > 0 && (
              <>
                {/* STATS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Stat label="With phone" value={`${stats.withPhone}/${parsed.length}`} />
                  <Stat label="With email" value={`${stats.withEmail}/${parsed.length}`} />
                  <Stat label="Brands"
                    value={Object.entries(stats.brands).map(([b, n]) => `${b} ${n}`).join(" · ") || "—"} />
                  <Stat label="Countries"
                    value={Object.entries(stats.countries).map(([c, n]) => `${c} ${n}`).join(" · ") || "—"} />
                </div>

                {/* CANONICAL OUTPUT */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Canonical output ({TEMPLATE})</p>
                  <Textarea readOnly value={maskedOutput} rows={Math.min(14, Math.max(4, parsed.length + 1))}
                    className="bg-background/60 font-mono text-[11px]" />
                  <p className="mt-2 text-[10px] text-muted-foreground">Preview masks card number and CVV. Copy and download still use the real formatted data.</p>
                </div>

                {/* TABLE PREVIEW */}
                <div className="rounded-lg border border-border/40 overflow-hidden">
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-[11px]">
                      <thead className="bg-secondary/60 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
                        <tr>
                          <th className="p-2 text-left">CC</th>
                          <th className="p-2">MM</th>
                          <th className="p-2">YY</th>
                          <th className="p-2 text-left">Name</th>
                          <th className="p-2 text-left">City</th>
                          <th className="p-2">ST</th>
                          <th className="p-2">ZIP</th>
                          <th className="p-2">CC2</th>
                          <th className="p-2">Tel</th>
                          <th className="p-2">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.slice(0, 100).map((c, i) => (
                          <tr key={i} className={`border-t border-border/40 ${i % 2 ? "bg-secondary/20" : ""}`}>
                            <td className="p-2 font-mono">
                              <div className="flex items-center gap-2 whitespace-nowrap">
                                <BrandLogo brand={detectBrand(c.cc)} className="h-4" />
                                <span>{maskCardNumber(c.cc)}</span>
                              </div>
                            </td>
                            <Cell v={c.month} />
                            <Cell v={c.year} />
                            <Cell v={c.name} truncate />
                            <Cell v={c.city} truncate />
                            <Cell v={c.state} />
                            <Cell v={c.zip} />
                            <Cell v={c.country} />
                            <Cell v={c.tel} truncate />
                            <Cell v={c.email} truncate />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsed.length > 100 && (
                    <p className="p-2 text-center text-[10px] text-muted-foreground bg-secondary/20">
                      Showing first 100 of {parsed.length} — full list is in the canonical output above.
                    </p>
                  )}
                </div>
              </>
            )}

            {parsed.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No cards could be extracted. Make sure each line contains at least a 12–19 digit card number.
              </p>
            )}
          </section>
        )}

        {/* FAILED */}
        {failed.length > 0 && (
          <section className="glass rounded-2xl p-6 border border-warning/40 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <h2 className="font-display tracking-wider text-warning">{failed.length} LINE{failed.length === 1 ? "" : "S"} SKIPPED</h2>
            </div>
            <p className="text-xs text-muted-foreground">No card number could be detected on these lines. Fix manually and re-run.</p>
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

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="font-display text-sm text-primary-glow truncate" title={value}>{value}</p>
  </div>
);

const Cell = ({ v, truncate }: { v: string; truncate?: boolean }) => (
  <td className={`p-2 text-center ${truncate ? "max-w-[120px] truncate text-left" : ""} ${v === "null" ? "text-muted-foreground/50 italic" : "font-mono"}`} title={v}>
    {v}
  </td>
);

const maskCardNumber = (value: string) => (value && value !== "null" ? `${value.slice(0, 6)}••••••${value.slice(-4)}` : "null");

export default SellerFormat;
