import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { cardsApi, payoutsApi, profileApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BRANDS, COUNTRIES, BrandLogo, countryFlag, detectBrandFromBin } from "@/lib/brands";
import { Plus, Trash2, Upload, DollarSign, TrendingUp, Package, CheckCircle2, Wallet, Clock, Percent, PiggyBank, BadgeCheck, Check, X } from "lucide-react";
import { toast } from "sonner";

interface CardRow { id: string; bin: string; brand: string; country: string; price: number; status: string; base: string; created_at: string; }
interface Payout { id: string; amount: number; method: string; address: string; status: string; created_at: string; }

const SellerPanel = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [commissionPct, setCommissionPct] = useState<number>(20);
  const [isVisible, setIsVisible] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [bulk, setBulk] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("USDT");
  const [payoutAddress, setPayoutAddress] = useState("");
  const [form, setForm] = useState({
    bin: "", brand: "VISA", country: "US", state: "", city: "", zip: "",
    exp_month: "", exp_year: "", price: "1.5", base: "", refundable: false, has_phone: true, has_email: true,
  });

  const load = async () => {
    if (!user) return;
    try {
      const [c, p, prof] = await Promise.allSettled([
        cardsApi.mine(),
        payoutsApi.mine(),
        profileApi.get(),
      ]);
      if (c.status === "fulfilled") setCards((c.value.cards ?? []) as unknown as CardRow[]);
      if (p.status === "fulfilled") setPayouts((p.value.payouts ?? []) as unknown as Payout[]);
      if (prof.status === "fulfilled") {
        const pr = prof.value.profile as any;
        setCommissionPct(Number(pr.commission_percent ?? 20));
        setIsVisible(!!pr.is_seller_visible);
        setIsVerified(!!pr.is_seller_verified);
      }
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, [user]);

  const stats = useMemo(() => {
    const sold = cards.filter((c) => c.status === "sold");
    const available = cards.filter((c) => c.status === "available");
    const gross = sold.reduce((s, c) => s + Number(c.price), 0);
    const platformFee = gross * (commissionPct / 100);
    const netEarnings = gross - platformFee;
    const conversion = cards.length ? (sold.length / cards.length) * 100 : 0;
    const paid = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
    const pending = payouts.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);
    const available_balance = netEarnings - paid - pending;
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().slice(0, 10);
      const total = sold.filter((c) => c.created_at.slice(0, 10) === key).reduce((s, c) => s + Number(c.price), 0);
      return { key, total: total * (1 - commissionPct / 100) };
    });
    const max = Math.max(1, ...days.map((d) => d.total));
    return { gross, platformFee, netEarnings, soldCount: sold.length, availableCount: available.length, conversion, paid, pending, available_balance, days, max };
  }, [cards, payouts, commissionPct]);

  const submit = async () => {
    if (!user || !form.bin || !form.price) return toast.error("BIN and price required");
    try {
      await cardsApi.create({
        ...form, price: Number(form.price),
        base: form.base || `${new Date().toISOString().slice(0,10)}_${form.country}_${form.brand}_$${form.price}`,
      });
      toast.success("Card listed"); setShowForm(false); load();
      setForm({ ...form, bin: "" });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const bulkUpload = async () => {
    if (!user || !bulk) return;
    const lines = bulk.trim().split("\n").filter(Boolean);
    const rows = lines.map((line) => {
      const [bin, brand, country, state, city, zip, exp_month, exp_year, price] = line.split(",").map((s) => s.trim());
      return {
        bin, brand: (brand || "VISA").toUpperCase(), country: (country || "US").toUpperCase(),
        state, city, zip, exp_month, exp_year, price: Number(price || 1.5),
        base: `${new Date().toISOString().slice(0,10)}_${country}_${brand}_$${price}`,
        refundable: false, has_phone: true, has_email: true,
      };
    });
    try {
      await cardsApi.bulkCreate(rows);
      toast.success(`Uploaded ${rows.length} cards`); setBulk(""); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const remove = async (id: string) => {
    try { await cardsApi.del(id); load(); } catch { /* ignore */ }
  };

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");

  const toggleOne = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = cards.length > 0 && cards.every((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) cards.forEach((c) => n.delete(c.id));
      else cards.forEach((c) => n.add(c.id));
      return n;
    });

  const saveEdit = async (id: string) => {
    const p = Number(editPrice);
    if (!p || p <= 0) return toast.error("Invalid price");
    try {
      await cardsApi.update(id, { price: p });
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, price: p } : c)));
      setEditingId(null);
      toast.success("Price updated");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const bulkUpdatePrice = async () => {
    const ids = Array.from(selected);
    const p = Number(bulkPrice);
    if (ids.length === 0) return toast.error("Select cards first");
    if (!p || p <= 0) return toast.error("Enter a valid price");
    try {
      await cardsApi.bulkUpdate(ids, { price: p });
      toast.success(`Updated price on ${ids.length} cards`);
      setBulkPrice(""); setSelected(new Set()); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} cards?`)) return;
    try {
      await cardsApi.bulkDelete(ids);
      toast.success(`Deleted ${ids.length}`);
      setSelected(new Set()); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const requestPayout = async () => {
    if (!user) return;
    const amt = Number(payoutAmount);
    if (!amt || amt < 50) return toast.error("Minimum payout is $50");
    if (amt > stats.available_balance) return toast.error("Insufficient balance");
    if (!payoutAddress.trim()) return toast.error("Wallet address required");
    try {
      await payoutsApi.request({ amount: amt, method: payoutMethod, destination: payoutAddress.trim() });
      toast.success("Payout requested"); setPayoutAmount(""); setPayoutAddress(""); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-black neon-text">SELLER DASHBOARD</h1>
            <p className="text-sm text-muted-foreground mt-1">Earnings, commission, and payout history</p>
            <Link to="/seller/price-rules" className="text-xs text-primary-glow hover:underline mt-1 inline-block">⚡ Manage Price Rules</Link>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isVerified && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/40 text-xs text-primary-glow">
                <BadgeCheck className="h-3.5 w-3.5" />Verified seller
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${
              isVisible ? "bg-success/15 border-success/40 text-success" : "bg-secondary/40 border-border text-muted-foreground"
            }`}>
              {isVisible ? "Public profile" : "Private profile"}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/40 text-xs text-gold">
              <Percent className="h-3 w-3" />{commissionPct.toFixed(1)}% platform fee
            </span>
          </div>
        </div>

        <section className="glass-neon rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <PiggyBank className="h-5 w-5 text-gold" />
            <h2 className="font-display tracking-wider text-primary-glow">EARNINGS &amp; COMMISSION SPLIT</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Mini label="Gross sales (100%)" value={`$${stats.gross.toFixed(2)}`} />
            <Mini label={`Platform fee (${commissionPct.toFixed(1)}%)`} value={`-$${stats.platformFee.toFixed(2)}`} />
            <Mini label={`Net earnings (${(100 - commissionPct).toFixed(1)}%)`} value={`$${stats.netEarnings.toFixed(2)}`} highlight />
          </div>
          <div className="h-3 rounded-full overflow-hidden bg-secondary/60 flex">
            <div className="bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${100 - commissionPct}%` }} />
            <div className="bg-gold/60" style={{ width: `${commissionPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground mt-2">
            <span>You keep {(100 - commissionPct).toFixed(1)}%</span>
            <span>Platform {commissionPct.toFixed(1)}%</span>
          </div>
        </section>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={DollarSign} label="Net earnings" value={`$${stats.netEarnings.toFixed(2)}`} accent="gold" />
          <Stat icon={TrendingUp} label="Cards sold" value={String(stats.soldCount)} accent="primary" />
          <Stat icon={Package} label="Available" value={String(stats.availableCount)} accent="primary" />
          <Stat icon={CheckCircle2} label="Conversion" value={`${stats.conversion.toFixed(1)}%`} accent="success" />
        </div>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-display tracking-wider text-primary-glow mb-4">NET EARNINGS · LAST 14 DAYS</h2>
          <div className="flex items-end gap-2 h-40">
            {stats.days.map((d) => (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t bg-gradient-to-t from-primary/40 to-primary-glow/80 transition-all"
                  style={{ height: `${(d.total / stats.max) * 100}%`, minHeight: d.total ? 4 : 2 }}
                  title={`$${d.total.toFixed(2)}`} />
                <span className="text-[9px] text-muted-foreground font-mono">{d.key.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-neon rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="h-5 w-5 text-primary-glow" />
            <h2 className="font-display tracking-wider text-primary-glow">PAYOUTS</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <Mini label="Available to withdraw" value={`$${stats.available_balance.toFixed(2)}`} highlight />
            <Mini label="Pending" value={`$${stats.pending.toFixed(2)}`} />
            <Mini label="Paid out" value={`$${stats.paid.toFixed(2)}`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} type="number" min={50} placeholder="Amount ($50 min)" className="bg-input/60" />
            <Select value={payoutMethod} onValueChange={setPayoutMethod}>
              <SelectTrigger className="bg-input/60"><SelectValue /></SelectTrigger>
              <SelectContent>{["USDT", "BTC", "LTC"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={payoutAddress} onChange={(e) => setPayoutAddress(e.target.value)} placeholder="Wallet address" className="bg-input/60 md:col-span-1 font-mono text-xs" />
            <Button onClick={requestPayout} className="bg-gradient-primary shadow-neon">Request payout</Button>
          </div>

          <div className="mt-5">
            <h3 className="font-display text-xs tracking-wider text-muted-foreground mb-2">PAYOUT HISTORY</h3>
            <div className="rounded-lg overflow-hidden border border-border/40">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-2.5 text-left">Date</th>
                    <th className="p-2.5 text-right">Amount</th>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5 text-left">Address</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-t border-border/40 hover:bg-secondary/30">
                      <td className="p-2.5 font-mono text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="p-2.5 text-right font-display text-primary-glow">${Number(p.amount).toFixed(2)}</td>
                      <td className="p-2.5 text-center">{p.method}</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground max-w-[160px] truncate" title={p.address}>{p.address}</td>
                      <td className="p-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          p.status === "paid" ? "bg-success/20 text-success" :
                          p.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
                        }`}>
                          {p.status === "paid" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {payouts.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-xs">No payouts yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <h2 className="font-display text-xl text-primary-glow tracking-wider">YOUR LISTINGS</h2>
          <div className="flex gap-2 flex-wrap">
            <a href="/seller/format">
              <Button variant="outline" className="border-primary/40 text-primary-glow">
                <Wallet className="h-4 w-4 mr-1" />Format fixer
              </Button>
            </a>
            <a href="/seller/upload">
              <Button variant="outline" className="border-primary/40 text-primary-glow">
                <Upload className="h-4 w-4 mr-1" />Auto-format upload
              </Button>
            </a>
            <Button onClick={() => setShowForm(!showForm)} className="bg-gradient-primary shadow-neon">
              <Plus className="h-4 w-4 mr-1" />List new card
            </Button>
          </div>
        </div>

        {showForm && (
          <section className="glass-neon rounded-2xl p-6">
            <h2 className="font-display tracking-wider text-primary-glow mb-4">NEW CARD</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="BIN"><Input value={form.bin} onChange={(e) => setForm({ ...form, bin: e.target.value })} className="bg-input/60" /></Field>
              <Field label="Brand">
                <Select value={form.brand} onValueChange={(v) => setForm({ ...form, brand: v })}>
                  <SelectTrigger className="bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>{BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Country">
                <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                  <SelectTrigger className="bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Price ($)"><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-input/60" /></Field>
            </div>
            <Button onClick={submit} className="mt-4 bg-gradient-primary shadow-neon">List card</Button>
          </section>
        )}

        <section className="glass rounded-2xl p-6">
          <h2 className="font-display tracking-wider text-primary-glow mb-3">BULK UPLOAD (CSV)</h2>
          <p className="text-xs text-muted-foreground mb-2">Format: <code className="text-primary-glow">bin,brand,country,state,city,zip,exp_month,exp_year,price</code></p>
          <Textarea rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)} className="bg-input/60 font-mono text-xs" placeholder="411111,VISA,US,NY,New York,10001,12,28,1.5" />
          <Button onClick={bulkUpload} className="mt-3 bg-gradient-primary shadow-neon"><Upload className="h-4 w-4 mr-1" />Upload</Button>
        </section>

        {selected.size > 0 && (
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/40 flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm text-primary-glow">{selected.size} selected</span>
            <Input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} type="number" step="0.01" placeholder="New price" className="bg-input/60 h-8 w-28 text-xs" />
            <Button size="sm" onClick={bulkUpdatePrice} className="bg-gradient-primary">Set price</Button>
            <Button size="sm" variant="destructive" onClick={bulkDelete}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}

        <div className="overflow-x-auto glass rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2.5 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-primary" /></th>
                <th className="p-2.5 text-left">BIN</th>
                <th className="p-2.5">Brand</th>
                <th className="p-2.5">Country</th>
                <th className="p-2.5 text-right">Price</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} className={`border-t border-border/40 ${selected.has(c.id) ? "bg-primary/5" : ""}`}>
                  <td className="p-2.5 text-center"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} className="accent-primary" /></td>
                  <td className="p-2.5 font-mono">{c.bin}</td>
                  <td className="p-2.5 text-center">{c.brand}</td>
                  <td className="p-2.5 text-center">{countryFlag(c.country)} {c.country}</td>
                  <td className="p-2.5 text-right text-primary-glow font-display">
                    {editingId === c.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} type="number" step="0.01"
                          className="bg-input/60 h-7 w-20 text-xs text-right" autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(c.id); if (e.key === "Escape") setEditingId(null); }} />
                        <button onClick={() => saveEdit(c.id)} className="text-success"><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingId(c.id); setEditPrice(String(c.price)); }} className="hover:underline">${Number(c.price).toFixed(2)}</button>
                    )}
                  </td>
                  <td className="p-2.5 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                      c.status === "available" ? "bg-success/20 text-success border-success/40" :
                      c.status === "sold" ? "bg-secondary text-muted-foreground border-border" : "bg-warning/20 text-warning border-warning/40"
                    }`}>{c.status}</span>
                  </td>
                  <td className="p-2.5 text-right">
                    <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {cards.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No cards listed yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
};

const Mini = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`p-3 rounded-lg border ${highlight ? "bg-primary/10 border-primary/40" : "bg-secondary/30 border-border/40"}`}>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={`font-display text-xl font-bold mt-1 ${highlight ? "neon-text" : "text-foreground"}`}>{value}</p>
  </div>
);

const Stat = ({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent: "gold" | "primary" | "success" }) => {
  const color = accent === "gold" ? "gold-text" : accent === "success" ? "text-success" : "neon-text";
  const iconColor = accent === "gold" ? "text-gold" : accent === "success" ? "text-success" : "text-primary-glow";
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <p className={`mt-2 font-display text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

export default SellerPanel;
