import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo, countryFlag } from "@/lib/brands";
import { BadgeCheck, Store, ArrowLeft, ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Profile {
  id: string;
  display_name: string | null;
  username: string;
  seller_display_name: string | null;
  seller_bio: string | null;
  is_seller_verified: boolean;
  is_seller_visible: boolean;
  avatar_url: string | null;
}
interface Card {
  id: string; bin: string; brand: string; country: string; price: number;
  base: string; refundable: boolean; exp_month: string | null; exp_year: string | null;
}

const SellerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const PAGE_SIZE = 50;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchPage = async (sellerId: string, from: number) => {
    const { data, count } = await supabase
      .from("cards")
      .select("id,bin,brand,country,price,base,refundable,exp_month,exp_year", { count: "exact" })
      .eq("seller_id", sellerId).eq("status", "available")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    return { rows: (data ?? []) as Card[], count: count ?? 0 };
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [p, page] = await Promise.all([
        supabase.from("profiles").select("id,display_name,username,seller_display_name,seller_bio,is_seller_verified,is_seller_visible,avatar_url").eq("id", id).maybeSingle(),
        fetchPage(id, 0),
      ]);
      setProfile(p.data as Profile | null);
      setCards(page.rows);
      setTotalCount(page.count);
      setHasMore(page.rows.length < page.count);
      setLoading(false);
    })();
  }, [id]);

  const loadMore = async () => {
    if (!id || loadingMore) return;
    setLoadingMore(true);
    const page = await fetchPage(id, cards.length);
    setCards((prev) => [...prev, ...page.rows]);
    setTotalCount(page.count);
    setHasMore(cards.length + page.rows.length < page.count);
    setLoadingMore(false);
  };

  if (loading) {
    return <AppShell><div className="glass rounded-2xl p-12 text-center text-muted-foreground">Loading seller…</div></AppShell>;
  }

  if (!profile || !profile.is_seller_visible) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-12 text-center">
          <Store className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-display text-lg">Seller not found</p>
          <p className="text-sm text-muted-foreground mt-1">This seller is private or doesn't exist.</p>
          <Link to="/shop" className="inline-block mt-4 text-primary-glow hover:underline text-sm">← Back to shop</Link>
        </div>
      </AppShell>
    );
  }

  const name = profile.seller_display_name || profile.display_name || profile.username;

  return (
    <AppShell>
      <div className="space-y-5">
        <Link to="/shop" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary-glow">
          <ArrowLeft className="h-4 w-4" />Back to shop
        </Link>

        <section className="glass-neon rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl font-display font-black text-background shadow-neon">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-3xl font-black neon-text">{name}</h1>
                {profile.is_seller_verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/40 text-xs text-primary-glow">
                    <BadgeCheck className="h-3.5 w-3.5" />Verified
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/20 border border-success/40 text-xs text-success">
                  <Store className="h-3.5 w-3.5" />Public seller
                </span>
              </div>
              {profile.seller_bio && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{profile.seller_bio}</p>}
              <p className="text-xs text-muted-foreground mt-3 font-mono">@{profile.username}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Available cards</p>
              <p className="font-display text-3xl gold-text">{cards.length}</p>
            </div>
          </div>
        </section>

        <section className="glass rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/40">
            <h2 className="font-display tracking-wider text-primary-glow">LISTINGS</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Brand</th>
                  <th className="p-3 text-left">BIN</th>
                  <th className="p-3">Country</th>
                  <th className="p-3">Exp</th>
                  <th className="p-3">Refund</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-left">Base</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c, i) => (
                  <tr key={c.id} className={`border-t border-border/40 hover:bg-primary/5 ${i % 2 ? "bg-secondary/20" : ""}`}>
                    <td className="p-3"><BrandLogo brand={c.brand} /></td>
                    <td className="p-3 font-mono">{c.bin}<span className="text-muted-foreground">********</span></td>
                    <td className="p-3 text-center">{countryFlag(c.country)} {c.country}</td>
                    <td className="p-3 text-center font-mono text-xs">{c.exp_month ?? "—"}/{c.exp_year ?? "—"}</td>
                    <td className="p-3 text-center text-xs">{c.refundable ? <span className="text-success">YES</span> : <span className="text-muted-foreground">NO</span>}</td>
                    <td className="p-3 text-right font-display text-primary-glow">${Number(c.price).toFixed(2)}</td>
                    <td className="p-3 text-[11px] text-muted-foreground max-w-[180px] truncate" title={c.base}>{c.base}</td>
                    <td className="p-3 text-right">
                      <Link to={`/shop?seller=${profile.id}`} className="text-primary-glow hover:underline text-xs inline-flex items-center gap-1">
                        <ShoppingCart className="h-3 w-3" />View in shop
                      </Link>
                    </td>
                  </tr>
                ))}
                {cards.length === 0 && (
                  <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">This seller has no available cards right now.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
};

export default SellerProfile;
