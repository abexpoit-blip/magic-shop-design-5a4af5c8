import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRANDS, COUNTRIES, BrandLogo, countryFlag } from "@/lib/brands";
import { ShoppingCart, Search, RotateCcw, Filter } from "lucide-react";
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
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [bin, setBin] = useState("");
  const [brand, setBrand] = useState("all");
  const [country, setCountry] = useState("all");
  const [zip, setZip] = useState("");
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    let q = supabase.from("cards").select("*").eq("status", "available").order("created_at", { ascending: false }).limit(100);
    if (bin) q = q.ilike("bin", `${bin}%`);
    if (brand !== "all") q = q.eq("brand", brand);
    if (country !== "all") q = q.eq("country", country);
    if (zip) q = q.ilike("zip", `${zip}%`);
    const { data } = await q;
    const list = (data ?? []) as Card[];
    setCards(list);

    const sellerIds = Array.from(new Set(list.map((c) => c.seller_id)));
    if (sellerIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", sellerIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; username: string }) => { map[p.id] = p.username; });
      setSellerNames(map);
    }
    setLoading(false);
  };

  const loadCart = async () => {
    if (!user) return;
    const { data } = await supabase.from("cart_items").select("card_id").eq("user_id", user.id);
    setCartIds(new Set((data ?? []).map((c: { card_id: string }) => c.card_id)));
  };

  useEffect(() => { load(); loadCart(); /* eslint-disable-next-line */ }, []);

  const addToCart = async (cardId: string) => {
    if (!user) return toast.error("Please log in");
    const { error } = await supabase.from("cart_items").insert({ user_id: user.id, card_id: cardId });
    if (error) return toast.error(error.message);
    setCartIds((s) => new Set(s).add(cardId));
    toast.success("Added to cart");
  };

  const reset = () => { setBin(""); setBrand("all"); setCountry("all"); setZip(""); setTimeout(load, 0); };

  const filterBar = useMemo(() => (
    <div className="glass rounded-2xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">BIN</label>
        <Input value={bin} onChange={(e) => setBin(e.target.value)} placeholder="411111" className="bg-input/60 mt-1" />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Brand</label>
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger className="bg-input/60 mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Country</label>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="bg-input/60 mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">ZIP</label>
        <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="zip code" className="bg-input/60 mt-1" />
      </div>
      <div className="flex gap-2">
        <Button onClick={load} className="flex-1 bg-gradient-primary shadow-neon"><Search className="h-4 w-4 mr-1" />Search</Button>
        <Button onClick={reset} variant="outline" className="border-border/60"><RotateCcw className="h-4 w-4" /></Button>
      </div>
    </div>
  ), [bin, brand, country, zip]);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-black neon-text">SHOP</h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <Filter className="h-3 w-3" /> {cards.length} cards available
            </p>
          </div>
        </div>

        {filterBar}

        {/* Card grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl h-56 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cards.map((c) => (
              <article key={c.id} className="group glass rounded-2xl p-5 hover:neon-border transition-all relative overflow-hidden">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl group-hover:bg-primary/20 transition" />
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <BrandLogo brand={c.brand} />
                    <span className="text-3xl" title={c.country}>{countryFlag(c.country)}</span>
                  </div>

                  <div className="font-display text-2xl tracking-[0.18em] text-foreground mb-1">
                    {c.bin}<span className="text-muted-foreground">••••</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Exp {c.exp_month ?? "--"}/{c.exp_year ?? "--"} · {c.refundable ? "Refundable" : "Non-ref"}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <Field label="State" value={c.state ?? "—"} />
                    <Field label="City" value={c.city ?? "—"} />
                    <Field label="ZIP" value={c.zip ?? "—"} />
                    <Field label="Country" value={c.country} />
                    <Field label="Phone" value={c.has_phone ? "yes" : "no"} />
                    <Field label="Email" value={c.has_email ? "yes" : "no"} />
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Seller</p>
                      <p className="text-xs font-medium text-primary-glow">{sellerNames[c.seller_id] ?? "scorpion"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Price</p>
                      <p className="font-display text-2xl font-bold neon-text">${Number(c.price).toFixed(2)}</p>
                    </div>
                  </div>

                  <Button onClick={() => addToCart(c.id)} disabled={cartIds.has(c.id)}
                    className="w-full mt-4 bg-gradient-primary shadow-neon disabled:opacity-50">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {cartIds.has(c.id) ? "In cart" : "Add to cart"}
                  </Button>
                </div>
              </article>
            ))}
            {cards.length === 0 && (
              <div className="col-span-full glass rounded-2xl p-12 text-center text-muted-foreground">
                No cards match your filters. Sellers can list new cards from the Seller Panel.
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="px-2 py-1 rounded-md bg-secondary/40 border border-border/40">
    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-xs font-medium text-foreground truncate">{value}</p>
  </div>
);

export default Shop;
