import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BRANDS, COUNTRIES, BrandLogo, countryFlag } from "@/lib/brands";
import { Plus, Trash2, Upload, DollarSign, TrendingUp, Package, CheckCircle2, Wallet, Clock, Percent, PiggyBank, BadgeCheck } from "lucide-react";
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
    const [c, p, prof] = await Promise.all([
      supabase.from("cards").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
      supabase.from("payouts").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("commission_percent,is_seller_visible,is_seller_verified").eq("id", user.id).maybeSingle(),
    ]);
    setCards((c.data ?? []) as CardRow[]);
    setPayouts((p.data ?? []) as Payout[]);
    if (prof.data) {
      setCommissionPct(Number(prof.data.commission_percent ?? 20));
      setIsVisible(!!prof.data.is_seller_visible);
      setIsVerified(!!prof.data.is_seller_verified);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

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
    const { error } = await supabase.from("cards").insert({
      seller_id: user.id, ...form, price: Number(form.price), base: form.base || `${new Date().toISOString().slice(0,10)}_${form.country}_${form.brand}_$${form.price}`,
    });
    if (error) return toast.error(error.message);
    toast.success("Card listed"); setShowForm(false); load();
    setForm({ ...form, bin: "" });
  };

  const bulkUpload = async () => {
    if (!user || !bulk) return;
    const lines = bulk.trim().split("\n").filter(Boolean);
    const rows = lines.map((line) => {
      const [bin, brand, country, state, city, zip, exp_month, exp_year, price] = line.split(",").map((s) => s.trim());
      return {
        seller_id: user.id, bin, brand: (brand || "VISA").toUpperCase(), country: (country || "US").toUpperCase(),
        state, city, zip, exp_month, exp_year, price: Number(price || 1.5),
        base: `${new Date().toISOString().slice(0,10)}_${country}_${brand}_$${price}`,
        refundable: false, has_phone: true, has_email: true,
      };
    });
    const { error } = await supabase.from("cards").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Uploaded ${rows.length} cards`); setBulk(""); load();
  };

  const remove = async (id: string) => {
    await supabase.from("cards").delete().eq("id", id);
    load();
  };

  const requestPayout = async () => {
    if (!user) return;
    const amt = Number(payoutAmount);
    if (!amt || amt < 50) return toast.error("Minimum payout is $50");
    if (amt > stats.available_balance) return toast.error("Insufficient balance");
    if (!payoutAddress.trim()) return toast.error("Wallet address required");
    const { error } = await supabase.from("payouts").insert({
      seller_id: user.id, amount: amt, method: payoutMethod, address: payoutAddress.trim(), status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success("Payout requested"); setPayoutAmount(""); setPayoutAddress(""); load();
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-black neon-text">SELLER DASHBOARD</h1>
            <p className="text-sm text-muted-foreground mt-1">Earnings, commission, and payout history</p>
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

        {/* COMMISSION SPLIT BANNER */}
        <section className="glass-neon rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <PiggyBank className="h-5 w-5 text-gold" />
            <h2 className="font-display tracking-wider text-primary-glow">EARNINGS &amp; COMMISSION SPLIT</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Mini label={`Gross sales (100%)`} value={`$${stats.gross.toFixed(2)}`} />
            <Mini label={`Platform fee (${commissionPct.toFixed(1)}%)`} value={`-$${stats.platformFee.toFixed(2)}`} />
            <Mini label={`Net earnings (${(100 - commissionPct).toFixed(1)}%)`} value={`$${stats.netEarnings.toFixed(2)}`} highlight />
          </div>
          {/* Visual split bar */}
          <div className="h-3 rounded-full overflow-hidden bg-secondary/60 flex">
            <div className="bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${100 - commissionPct}%` }} title={`Your share ${(100 - commissionPct).toFixed(1)}%`} />
            <div className="bg-gold/60" style={{ width: `${commissionPct}%` }} title={`Platform fee ${commissionPct.toFixed(1)}%`} />
          </div>
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground mt-2">
            <span>You keep {(100 - commissionPct).toFixed(1)}%</span>
            <span>Platform {commissionPct.toFixed(1)}%</span>
          </div>
        </section>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={DollarSign} label="Net earnings" value={`$${stats.netEarnings.toFixed(2)}`} accent="gold" />
          <Stat icon={TrendingUp} label="Cards sold" value={String(stats.soldCount)} accent="primary" />
          <Stat icon={Package} label="Available" value={String(stats.availableCount)} accent="primary" />
          <Stat icon={CheckCircle2} label="Conversion" value={`${stats.conversion.toFixed(1)}%`} accent="success" />
        </div>

        {/* Revenue chart */}
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

        {/* PAYOUT */}
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

          {/* PAYOUT HISTORY */}
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

        {/* LISTING */}
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
              <Field label="Price (USD)"><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-input/60" /></Field>
              <Field label="State"><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="bg-input/60" /></Field>
              <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="bg-input/60" /></Field>
              <Field label="ZIP"><Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} className="bg-input/60" /></Field>
              <Field label="Exp MM/YY">
                <div className="flex gap-2">
                  <Input value={form.exp_month} onChange={(e) => setForm({ ...form, exp_month: e.target.value })} placeholder="MM" className="bg-input/60" />
                  <Input value={form.exp_year} onChange={(e) => setForm({ ...form, exp_year: e.target.value })} placeholder="YY" className="bg-input/60" />
                </div>
              </Field>
            </div>
            <Button onClick={submit} className="mt-4 bg-gradient-primary shadow-neon">Publish</Button>
          </section>
        )}

        <section className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Upload className="h-4 w-4 text-primary-glow" />
            <h2 className="font-display tracking-wider text-primary-glow">BULK UPLOAD</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-2">CSV format: <code className="text-primary-glow">bin,brand,country,state,city,zip,exp_month,exp_year,price</code></p>
          <Textarea rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="411111,VISA,US,NY,New York,10001,12,28,1.5" className="bg-input/60 font-mono text-xs" />
          <Button onClick={bulkUpload} className="mt-3 bg-gradient-primary shadow-neon">Upload all</Button>
        </section>

        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Brand</th>
                <th className="p-3 text-left">BIN</th>
                <th className="p-3 text-left">Country</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} className="border-t border-border/40 hover:bg-secondary/30">
                  <td className="p-3"><BrandLogo brand={c.brand} /></td>
                  <td className="p-3 font-mono">{c.bin}</td>
                  <td className="p-3">{countryFlag(c.country)} {c.country}</td>
                  <td className="p-3 text-right font-display text-primary-glow">${Number(c.price).toFixed(2)}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      c.status === "available" ? "bg-success/20 text-success" :
                      c.status === "sold" ? "bg-muted text-muted-foreground" : "bg-warning/20 text-warning"
                    }`}>{c.status}</span>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {cards.length === 0 && (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No cards listed yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
};

const Stat = ({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent: "gold" | "primary" | "success" }) => (
  <div className="glass rounded-2xl p-4">
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Icon className={`h-4 w-4 ${accent === "gold" ? "text-gold" : accent === "success" ? "text-success" : "text-primary-glow"}`} />
    </div>
    <p className={`mt-2 font-display text-2xl font-bold ${accent === "gold" ? "gold-text" : accent === "success" ? "text-success" : "neon-text"}`}>{value}</p>
  </div>
);

const Mini = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`p-3 rounded-lg border ${highlight ? "bg-primary/10 border-primary/40" : "bg-secondary/40 border-border/40"}`}>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={`font-display text-lg font-bold mt-0.5 ${highlight ? "gold-text" : "text-foreground"}`}>{value}</p>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

export default SellerPanel;
