import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { priceRulesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PriceRule {
  id: string;
  country: string | null;
  brand: string | null;
  base: string | null;
  level: string | null;
  price: number;
  created_at: string;
}

const SellerPriceRules = () => {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ country: "", brand: "", base: "", level: "", price: "" });

  const load = async () => {
    try {
      const r = await priceRulesApi.mine();
      setRules((r.rules ?? []) as PriceRule[]);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    const price = parseFloat(form.price);
    if (!price || price <= 0) { toast.error("Enter a valid price"); return; }
    setSubmitting(true);
    try {
      await priceRulesApi.create({
        country: form.country.trim() || null,
        brand: form.brand.trim() || null,
        base: form.base.trim() || null,
        level: form.level.trim() || null,
        price,
      });
      toast.success("Price rule created");
      setForm({ country: "", brand: "", base: "", level: "", price: "" });
      setShowForm(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSubmitting(false); }
  };

  const remove = async (id: string) => {
    try {
      await priceRulesApi.del(id);
      toast.success("Rule deleted");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-primary-glow" />
            <h1 className="font-display text-2xl tracking-wider text-primary-glow">PRICE RULES</h1>
          </div>
          <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-primary/20 border border-primary/60 text-primary-glow hover:bg-primary/30">
            <Plus className="h-3.5 w-3.5 mr-1" />{showForm ? "Cancel" : "Add Rule"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Auto-pricing rules apply when you upload cards. Cards matching a rule's country/brand/base/level will use that price automatically.
        </p>

        {showForm && (
          <div className="glass rounded-2xl p-6 space-y-4 border border-primary/30">
            <h2 className="font-display tracking-wider text-sm text-primary-glow">NEW PRICE RULE</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Country</label>
                <Input placeholder="e.g. US" maxLength={100} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="bg-secondary/40 border-border/40" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Brand</label>
                <Input placeholder="e.g. VISA" maxLength={100} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="bg-secondary/40 border-border/40" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Base</label>
                <Input placeholder="e.g. DEBIT" maxLength={100} value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })} className="bg-secondary/40 border-border/40" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Level</label>
                <Input placeholder="e.g. CLASSIC" maxLength={100} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="bg-secondary/40 border-border/40" />
              </div>
            </div>
            <div className="max-w-xs">
              <label className="text-xs text-muted-foreground mb-1 block">Price ($)</label>
              <Input type="number" step="0.01" min="0.01" max="100000" placeholder="0.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-secondary/40 border-border/40" />
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full">{submitting ? "Creating…" : "Create Rule"}</Button>
          </div>
        )}

        {rules.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <DollarSign className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No price rules yet. Add one to auto-price your uploads.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} className="glass rounded-xl p-4 border border-border/40 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  {r.country && <span className="px-2 py-0.5 rounded bg-secondary/60 border border-border/40 text-xs font-mono">{r.country}</span>}
                  {r.brand && <span className="px-2 py-0.5 rounded bg-secondary/60 border border-border/40 text-xs font-mono">{r.brand}</span>}
                  {r.base && <span className="px-2 py-0.5 rounded bg-secondary/60 border border-border/40 text-xs font-mono">{r.base}</span>}
                  {r.level && <span className="px-2 py-0.5 rounded bg-secondary/60 border border-border/40 text-xs font-mono">{r.level}</span>}
                  {!r.country && !r.brand && !r.base && !r.level && <span className="text-xs text-muted-foreground italic">All cards (catch-all)</span>}
                  <span className="text-primary-glow font-display">${Number(r.price).toFixed(2)}</span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)} className="text-destructive hover:text-destructive/80 h-7 w-7">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default SellerPriceRules;
