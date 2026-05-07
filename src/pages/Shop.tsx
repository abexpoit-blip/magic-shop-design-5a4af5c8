import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { cardsApi, cartApi, sellersApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES, countryFlag, countryCode, BrandLogo, detectBrandFromBin } from "@/lib/brands";
import { Search, RotateCcw, ShoppingCart, RefreshCw, PackageX, X, Store, ChevronLeft, ChevronRight, Clock, Sparkles, Tag, ArrowUpDown } from "lucide-react";
import { TrustBadge } from "@/components/TrustBadge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Card {
  id: string; bin: string; brand: string; country: string; state: string | null;
  city: string | null; zip: string | null; exp_month: string | null; exp_year: string | null;
  refundable: boolean; has_phone: boolean; has_email: boolean; email?: string | null; base: string; price: number;
  status: string; seller_id: string; created_at: string;
}
interface Seller {
  id: string; username: string; seller_display_name: string | null; display_name: string | null;
  is_seller_verified: boolean;
  trust_tier?: "none" | "verified" | "trusted" | "vip";
}

function isExpiringSoon(card: Card): boolean {
  if (!card.exp_month || !card.exp_year) return false;
  const now = new Date();
  const curYear = now.getFullYear() % 100;
  const curMonth = now.getMonth() + 1;
  const ey = parseInt(card.exp_year);
  const em = parseInt(card.exp_month);
  if (isNaN(ey) || isNaN(em)) return false;
  const monthsLeft = (ey - curYear) * 12 + (em - curMonth);
  return monthsLeft >= 0 && monthsLeft <= 3;
}

function isRecentUpload(card: Card): boolean {
  if (!card.created_at) return false;
  const created = new Date(card.created_at);
  const now = new Date();
  const hoursAgo = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  return hoursAgo <= 48;
}

const Shop = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cards, setCards] = useState<Card[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [bin, setBin] = useState("");
  const [base, setBase] = useState("all");
  const [country, setCountry] = useState("");
  const [zip, setZip] = useState("");
  const [seller, setSeller] = useState<string>(searchParams.get("seller") ?? "all");
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastBin, setLastBin] = useState("");
  const [sort, setSort] = useState("expiry_asc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCards, setTotalCards] = useState(0);
  const [bases, setBases] = useState<string[]>([]);

  const sellerMap = useMemo(() => {
    const m = new Map<string, Seller>();
    sellers.forEach((s) => m.set(s.id, s));
    return m;
  }, [sellers]);

  const loadSellers = async () => {
    try {
      const res = await sellersApi.visible();
      setSellers((res.sellers ?? []) as unknown as Seller[]);
    } catch { setSellers([]); }
  };

  const loadBases = async () => {
    try {
      const res = await cardsApi.bases();
      setBases(res.bases ?? []);
    } catch { /* ignore */ }
  };

  const load = useCallback(async (auto = false, p = page) => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        per_page: 25,
        page: p,
        sort,
      };
      if (bin) params.bin = bin;
      if (base !== "all") params.base = base;
      if (country) params.country = country;
      if (zip) params.zip = zip;
      if (seller !== "all") params.seller_id = seller;
      const res = await cardsApi.browse(params);
      setCards((res.cards ?? []) as Card[]);
      setTotalPages(res.pages ?? 1);
      setTotalCards(res.total ?? 0);
    } catch { setCards([]); }
    setLastBin(bin);
    setLoading(false);
    if (!auto) setSearched(true);
  }, [bin, base, country, zip, seller, sort, page]);

  const loadCart = async () => {
    if (!user) return;
    try {
      const { items } = await cartApi.list();
      setCartIds(new Set((items ?? []).map((c) => c.card_id)));
    } catch { /* ignore */ }
  };

  useEffect(() => { loadSellers(); loadBases(); load(true, 1); loadCart(); }, []); // eslint-disable-line

  useEffect(() => {
    if (seller === "all") { searchParams.delete("seller"); } else { searchParams.set("seller", seller); }
    setSearchParams(searchParams, { replace: true });
    setPage(1);
    load(true, 1);
  }, [seller]); // eslint-disable-line

  useEffect(() => {
    setPage(1);
    load(true, 1);
  }, [sort]); // eslint-disable-line

  useEffect(() => {
    load(true, page);
  }, [page]); // eslint-disable-line

  useEffect(() => {
    if (bin.length >= 6) {
      const t = setTimeout(() => { setPage(1); load(false, 1); }, 350);
      return () => clearTimeout(t);
    }
  }, [bin]); // eslint-disable-line

  const nav = useNavigate();

  const addToCart = async (cardId: string) => {
    if (!user) return toast.error("Please log in");
    try {
      await cartApi.add(cardId);
      setCartIds((s) => new Set(s).add(cardId));
      window.dispatchEvent(new Event("cart-updated"));
      toast.success("Added to cart");
      nav("/cart");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const batchAdd = async () => {
    if (!user) return toast.error("Please log in");
    if (selected.size === 0) return toast.error("Select cards first");
    const ids = Array.from(selected).filter((id) => !cartIds.has(id));
    if (!ids.length) return toast.error("Already in cart");
    try {
      await cartApi.addBatch(ids);
      setCartIds((s) => { const n = new Set(s); ids.forEach((id) => n.add(id)); return n; });
      setSelected(new Set());
      window.dispatchEvent(new Event("cart-updated"));
      toast.success(`Added ${ids.length} to cart`);
      nav("/cart");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const reset = () => { setBin(""); setBase("all"); setCountry(""); setZip(""); setSeller("all"); setSort("expiry_asc"); setSearched(false); setPage(1); setTimeout(() => load(true, 1), 0); };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => s.size === cards.length ? new Set() : new Set(cards.map((c) => c.id)));

  const noResults = !loading && cards.length === 0 && (searched || bin.length >= 6);

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-3xl font-black neon-text">SHOP</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCards > 0 ? `${totalCards.toLocaleString()} cards in stock` : "Search by BIN — auto-detects after 6 digits"}
          </p>
        </div>

        <div className="glass rounded-2xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">BIN</label>
            <Input value={bin} onChange={(e) => setBin(e.target.value.replace(/\D/g, "").slice(0, 16))}
              placeholder="Please enter the card number" className="bg-input/60 mt-1 font-mono" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">BASE</label>
            <Select value={base} onValueChange={(v) => { setBase(v); setPage(1); setTimeout(() => load(true, 1), 0); }}>
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
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">SELLER</label>
            <Select value={seller} onValueChange={setSeller}>
              <SelectTrigger className="bg-input/60 mt-1"><SelectValue placeholder="seller" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sellers</SelectItem>
                {sellers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.seller_display_name || s.display_name || s.username}
                    {s.is_seller_verified && " ✓"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">ZIP</label>
            <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="Please enter your zip code" className="bg-input/60 mt-1" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { setPage(1); load(false, 1); }} className="flex-1 bg-gradient-primary shadow-neon"><Search className="h-4 w-4 mr-1" />search</Button>
            <Button onClick={reset} variant="outline" className="border-border/60"><RotateCcw className="h-4 w-4 mr-1" />reset</Button>
          </div>
        </div>

        {/* Sort + Actions bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button onClick={batchAdd} disabled={selected.size === 0}
              className="bg-success/20 text-success border border-success/40 hover:bg-success/30 disabled:opacity-50">
              <ShoppingCart className="h-4 w-4 mr-2" />Batch add {selected.size > 0 && `(${selected.size})`}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="bg-input/60 w-[180px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expiry_asc">Expiry: Soonest first</SelectItem>
                <SelectItem value="price_asc">Price: Low → High</SelectItem>
                <SelectItem value="price_desc">Price: High → Low</SelectItem>
                <SelectItem value="created_desc">Newest first</SelectItem>
              </SelectContent>
            </Select>
            <button onClick={() => load(true, page)} className="h-9 w-9 rounded-full glass flex items-center justify-center hover:neon-border transition" title="Refresh">
              <RefreshCw className="h-4 w-4 text-primary-glow" />
            </button>
          </div>
        </div>

        {seller !== "all" && sellerMap.get(seller) && (
          <div className="glass-neon rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Store className="h-4 w-4 text-primary-glow" />
              <span className="text-muted-foreground">Filtering by seller:</span>
              <Link to={`/seller/${seller}`} className="font-display text-primary-glow hover:underline inline-flex items-center gap-1.5">
                {sellerMap.get(seller)!.seller_display_name || sellerMap.get(seller)!.display_name || sellerMap.get(seller)!.username}
                <TrustBadge tier={sellerMap.get(seller)!.trust_tier} size="xs" />
              </Link>
            </div>
            <button onClick={() => setSeller("all")} className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1">
              <X className="h-3 w-3" />Clear
            </button>
          </div>
        )}

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

                {!loading && cards.map((c, idx) => {
                  const isCountryInState = COUNTRIES.some(ct => ct.code === c.state?.toUpperCase());
                  const isStateInCountry = c.country && c.country.length <= 3 && !COUNTRIES.some(ct => ct.code === c.country?.toUpperCase());
                  const displayCountry = (isCountryInState && isStateInCountry) ? c.state : c.country;
                  const displayState = (isCountryInState && isStateInCountry) ? c.country : c.state;
                  const expiring = isExpiringSoon(c);
                  const recent = isRecentUpload(c);

                  return (
                  <tr key={c.id} className={`border-t border-border/40 hover:bg-primary/5 transition ${idx % 2 ? "bg-secondary/20" : ""} ${expiring ? "bg-warning/5" : ""}`}>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="accent-primary cursor-pointer" />
                    </td>
                    <td className="p-3 font-mono text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <BrandLogo brand={c.brand || detectBrandFromBin(c.bin)} className="h-4" />
                        <span>{c.bin}<span className="text-muted-foreground">••••••</span></span>
                        {expiring && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded-full bg-warning/20 border border-warning/40 text-warning font-mono" title="Expiring soon — discounted">
                            🔥 SALE
                          </span>
                        )}
                        {recent && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded-full bg-success/20 border border-success/40 text-success font-mono" title="Recently uploaded">
                            ✨ NEW
                          </span>
                        )}
                      </div>
                      {sellerMap.get(c.seller_id) && (
                        <Link to={`/seller/${c.seller_id}`} onClick={(e) => e.stopPropagation()}
                          className="mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary-glow hover:bg-primary/20 transition">
                          <Store className="h-2.5 w-2.5" />
                          {sellerMap.get(c.seller_id)!.seller_display_name || sellerMap.get(c.seller_id)!.display_name || sellerMap.get(c.seller_id)!.username}
                          <TrustBadge tier={sellerMap.get(c.seller_id)!.trust_tier} size="xs" />
                        </Link>
                      )}
                    </td>
                    <td className="p-3 text-center text-muted-foreground">{c.refundable ? "YES" : "NO"}</td>
                    <td className="p-3 text-center font-mono">{c.exp_month ?? "—"}</td>
                    <td className="p-3 text-center font-mono">{c.exp_year ?? "—"}</td>
                    <td className="p-3 text-center max-w-[140px] truncate" title={c.city ?? ""}>{c.city ?? "—"}</td>
                    <td className="p-3 text-center">{displayState ?? "—"}</td>
                    <td className="p-3 text-center font-mono">{c.zip ?? "—"}</td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {countryFlag(displayCountry)} {countryCode(displayCountry)}
                      </span>
                    </td>
                    <td className="p-3 text-center text-xs">{c.has_phone ? <span className="text-success">yes</span> : <span className="text-muted-foreground">no</span>}</td>
                    <td className="p-3 text-center text-xs max-w-[180px] truncate" title={c.email ?? undefined}>
                      {c.email ? <span className="text-foreground">{c.email}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-center font-display text-primary-glow">
                      {expiring && <span className="text-warning">🔥 </span>}
                      {Number(c.price).toFixed(2)}
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground max-w-[180px] truncate" title={c.base}>{c.base}</td>
                    <td className="p-3 text-center">
                      {cartIds.has(c.id) ? (
                        <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-success/20 text-success border border-success/40">
                          <ShoppingCart className="h-3 w-3" />In cart
                        </span>
                      ) : (
                        <button onClick={() => addToCart(c.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-primary-glow text-white shadow-neon hover:shadow-neon-lg hover:scale-105 transition-all duration-200">
                          <ShoppingCart className="h-3.5 w-3.5" />Add to cart
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}

                {noResults && (
                  <tr>
                    <td colSpan={14} className="p-12 text-center">
                      <PackageX className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="font-display text-lg text-foreground">Not stocked yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {lastBin
                          ? <>No cards match BIN prefix <code className="px-1.5 py-0.5 rounded bg-secondary/60 text-primary-glow font-mono">{lastBin}</code>.</>
                          : "No cards match your filters."}
                      </p>
                      <Button onClick={reset} variant="outline" className="mt-4 border-primary/40 text-primary-glow hover:bg-primary/10">
                        <X className="h-4 w-4 mr-1.5" />Clear search
                      </Button>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-secondary/20">
              <p className="text-xs text-muted-foreground">
                Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, totalCards)} of {totalCards.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-primary/10 disabled:opacity-30 transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) {
                    p = i + 1;
                  } else if (page <= 4) {
                    p = i + 1;
                  } else if (page >= totalPages - 3) {
                    p = totalPages - 6 + i;
                  } else {
                    p = page - 3 + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-mono transition ${
                        page === p
                          ? "bg-primary/20 border border-primary/60 text-primary-glow"
                          : "text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-primary/10 disabled:opacity-30 transition"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default Shop;
