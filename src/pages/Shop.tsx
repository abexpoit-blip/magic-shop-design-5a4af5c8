import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES, countryFlag } from "@/lib/brands";
import { Search, RotateCcw, ShoppingCart, RefreshCw, PackageX, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Card {
  id: string; bin: string; brand: string; country: string; state: string | null;
  city: string | null; zip: string | null; exp_month: string | null; exp_year: string | null;
  refundable: boolean; has_phone: boolean; has_email: boolean; base: string; price: number;
  status: string; seller_id: string;
}

const Shop = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [bin, setBin] = useState("");
  const [base, setBase] = useState("all");
  const [country, setCountry] = useState("");
  const [zip, setZip] = useState("");
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastBin, setLastBin] = useState("");

  const load = async (auto = false) => {
    setLoading(true);
    let q = supabase.from("cards").select("*").eq("status", "available").order("created_at", { ascending: false }).limit(200);
    if (bin) q = q.ilike("bin", `${bin}%`);
    if (base !== "all") q = q.ilike("base", `%${base}%`);
    if (country) q = q.ilike("country", `${country}%`);
    if (zip) q = q.ilike("zip", `${zip}%`);
    const { data } = await q;
    setCards((data ?? []) as Card[]);
    setLastBin(bin);
    setLoading(false);
    if (!auto) setSearched(true);
  };

  const loadCart = async () => {
    if (!user) return;
    const { data } = await supabase.from("cart_items").select("card_id").eq("user_id", user.id);
    setCartIds(new Set((data ?? []).map((c: { card_id: string }) => c.card_id)));
  };

  useEffect(() => { load(true); loadCart(); /* eslint-disable-next-line */ }, []);

  // Auto-detect BIN: when 6+ digits typed, auto-search
  useEffect(() => {
    if (bin.length >= 6) {
      const t = setTimeout(() => load(), 350);
      return () => clearTimeout(t);
    }
  }, [bin]); // eslint-disable-line

  const addToCart = async (cardId: string) => {
    if (!user) return toast.error("Please log in");
    const { error } = await supabase.from("cart_items").insert({ user_id: user.id, card_id: cardId });
    if (error) return toast.error(error.message);
    setCartIds((s) => new Set(s).add(cardId));
    toast.success("Added to cart");
  };

  const batchAdd = async () => {
    if (!user) return toast.error("Please log in");
    if (selected.size === 0) return toast.error("Select cards first");
    const rows = Array.from(selected)
      .filter((id) => !cartIds.has(id))
      .map((card_id) => ({ user_id: user.id, card_id }));
    if (!rows.length) return toast.error("Already in cart");
    const { error } = await supabase.from("cart_items").insert(rows);
    if (error) return toast.error(error.message);
    setCartIds((s) => { const n = new Set(s); rows.forEach((r) => n.add(r.card_id)); return n; });
    setSelected(new Set());
    toast.success(`Added ${rows.length} to cart`);
  };

  const reset = () => { setBin(""); setBase("all"); setCountry(""); setZip(""); setSearched(false); setTimeout(() => load(true), 0); };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => s.size === cards.length ? new Set() : new Set(cards.map((c) => c.id)));

  const bases = useMemo(() => Array.from(new Set(cards.map((c) => c.base))).slice(0, 50), [cards]);
  const noResults = !loading && cards.length === 0 && (searched || bin.length >= 6);

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-3xl font-black neon-text">SHOP</h1>
          <p className="text-sm text-muted-foreground mt-1">Search by BIN — auto-detects after 6 digits</p>
        </div>

        {/* Filter bar */}
        <div className="glass rounded-2xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">BIN</label>
            <Input value={bin} onChange={(e) => setBin(e.target.value.replace(/\D/g, "").slice(0, 16))}
              placeholder="Please enter the card number" className="bg-input/60 mt-1 font-mono" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">BASE</label>
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger className="bg-input/60 mt-1"><SelectValue placeholder="base" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All bases</SelectItem>
                {bases.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">COUNTRY</label>
            <Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())}
              placeholder="Please enter country" className="bg-input/60 mt-1" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">ZIP</label>
            <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="Please enter your zip code" className="bg-input/60 mt-1" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => load()} className="flex-1 bg-gradient-primary shadow-neon"><Search className="h-4 w-4 mr-1" />search</Button>
            <Button onClick={reset} variant="outline" className="border-border/60"><RotateCcw className="h-4 w-4 mr-1" />reset</Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button onClick={batchAdd} disabled={selected.size === 0}
            className="bg-success/20 text-success border border-success/40 hover:bg-success/30 disabled:opacity-50">
            <ShoppingCart className="h-4 w-4 mr-2" />Batch add shopping cart {selected.size > 0 && `(${selected.size})`}
          </Button>
          <div className="flex gap-2">
            <button onClick={() => load()} className="h-9 w-9 rounded-full glass flex items-center justify-center hover:neon-border transition" title="Search">
              <Search className="h-4 w-4 text-primary-glow" />
            </button>
            <button onClick={() => load(true)} className="h-9 w-9 rounded-full glass flex items-center justify-center hover:neon-border transition" title="Refresh">
              <RefreshCw className="h-4 w-4 text-primary-glow" />
            </button>
          </div>
        </div>

        {/* Results table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 w-10">
                    <input type="checkbox" checked={cards.length > 0 && selected.size === cards.length}
                      onChange={toggleAll} className="accent-primary cursor-pointer" />
                  </th>
                  <th className="p-3 text-left">BIN</th>
                  <th className="p-3">refund</th>
                  <th className="p-3">month</th>
                  <th className="p-3">year</th>
                  <th className="p-3">city</th>
                  <th className="p-3">state</th>
                  <th className="p-3">zip</th>
                  <th className="p-3">country</th>
                  <th className="p-3">tel</th>
                  <th className="p-3">email</th>
                  <th className="p-3">prices</th>
                  <th className="p-3">base</th>
                  <th className="p-3">operation</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td colSpan={14} className="p-3"><div className="h-6 bg-secondary/40 rounded animate-pulse" /></td>
                    </tr>
                  ))
                )}

                {!loading && cards.map((c, idx) => (
                  <tr key={c.id} className={`border-t border-border/40 hover:bg-primary/5 transition ${idx % 2 ? "bg-secondary/20" : ""}`}>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="accent-primary cursor-pointer" />
                    </td>
                    <td className="p-3 font-mono text-foreground whitespace-nowrap">
                      {c.bin}<span className="text-muted-foreground">********</span>
                    </td>
                    <td className="p-3 text-center text-muted-foreground">{c.refundable ? "YES" : "NO"}</td>
                    <td className="p-3 text-center font-mono">{c.exp_month ?? "—"}</td>
                    <td className="p-3 text-center font-mono">{c.exp_year ?? "—"}</td>
                    <td className="p-3 text-center max-w-[140px] truncate" title={c.city ?? ""}>{c.city ?? "—"}</td>
                    <td className="p-3 text-center">{c.state ?? "—"}</td>
                    <td className="p-3 text-center font-mono">{c.zip ?? "—"}</td>
                    <td className="p-3 text-center whitespace-nowrap">{countryFlag(c.country)} {c.country}</td>
                    <td className="p-3 text-center text-xs">{c.has_phone ? <span className="text-success">yes</span> : <span className="text-muted-foreground">no</span>}</td>
                    <td className="p-3 text-center text-xs">{c.has_email ? <span className="text-success">yes</span> : <span className="text-muted-foreground">no</span>}</td>
                    <td className="p-3 text-center font-display text-primary-glow">{Number(c.price).toFixed(2)}</td>
                    <td className="p-3 text-[11px] text-muted-foreground max-w-[180px] truncate" title={c.base}>{c.base}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => addToCart(c.id)} disabled={cartIds.has(c.id)}
                        className="text-primary-glow hover:underline text-xs disabled:opacity-40 disabled:no-underline">
                        {cartIds.has(c.id) ? "In cart" : "Add to cart"}
                      </button>
                    </td>
                  </tr>
                ))}

                {noResults && (
                  <tr>
                    <td colSpan={14} className="p-12 text-center">
                      <PackageX className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="font-display text-lg text-foreground">Not stocked yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {bin ? `BIN "${bin}" is not in stock right now.` : "No cards match your filters."} Try a different BIN or check back later.
                      </p>
                    </td>
                  </tr>
                )}

                {!loading && !noResults && cards.length === 0 && (
                  <tr>
                    <td colSpan={14} className="p-12 text-center text-muted-foreground">
                      Search for a BIN above to find cards in stock.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Shop;
