import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingBag, CreditCard } from "lucide-react";
import { BrandLogo, countryFlag } from "@/lib/brands";
import { toast } from "sonner";

interface Card { id: string; bin: string; brand: string; country: string; price: number; base: string; exp_month: string | null; exp_year: string | null; }
interface Item { id: string; card: Card; }

const Cart = () => {
  const { user, profile, refresh } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("cart_items")
      .select("id, card_id").eq("user_id", user.id);
    const rows = (data ?? []) as { id: string; card_id: string }[];
    const ids = rows.map((r) => r.card_id);
    let cards: Card[] = [];
    if (ids.length) {
      const { data: cardRows } = await supabase
        .from("cards_public" as never)
        .select("id,bin,brand,country,price,base,exp_month,exp_year")
        .in("id", ids);
      cards = (cardRows ?? []) as Card[];
    }
    const cardMap = new Map(cards.map((c) => [c.id, c]));
    const list: Item[] = rows
      .map((r) => ({ id: r.id, card: cardMap.get(r.card_id) }))
      .filter((x): x is Item => !!x.card);
    setItems(list);
    setSelected(new Set(list.map((i) => i.id)));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const remove = async (id: string) => {
    await supabase.from("cart_items").delete().eq("id", id);
    setItems((arr) => arr.filter((i) => i.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
  };

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectedItems = items.filter((i) => selected.has(i.id));
  const total = selectedItems.reduce((s, i) => s + Number(i.card.price), 0);

  const checkout = async () => {
    if (!user || !profile) return;
    if (selectedItems.length === 0) return toast.error("Select at least one card");
    if (Number(profile.balance) < total) return toast.error("Insufficient balance — please recharge");
    setBusy(true);
    try {
      const { data: order, error } = await supabase.from("orders")
        .insert({ user_id: user.id, total }).select().single();
      if (error) throw error;
      const cardIds = selectedItems.map((i) => i.card.id);
      // Insert order_items first with metadata snapshot (id is required so the
      // RLS policy "Buyer view purchased card" matches on the next fetch).
      const initialItems = selectedItems.map((i) => ({
        order_id: order.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        card_snapshot: JSON.parse(JSON.stringify(i.card)) as any,
        price: Number(i.card.price),
      }));
      const { data: insertedItems, error: oiErr } = await supabase
        .from("order_items").insert(initialItems).select();
      if (oiErr) throw oiErr;

      // Now buyer can read full card data via RLS; backfill the snapshot with
      // sensitive fields so it remains visible after the card row changes.
      const { data: full } = await supabase
        .from("cards")
        .select("id,bin,brand,country,price,base,exp_month,exp_year,cc_number,cvv,holder_name,email,phone,address,state,city,zip")
        .in("id", cardIds);
      const fullMap = new Map((full ?? []).map((c) => [(c as { id: string }).id, c]));
      await Promise.all(
        (insertedItems ?? []).map((row) => {
          const snap = (row as { card_snapshot: { id: string } }).card_snapshot;
          const merged = { ...snap, ...(fullMap.get(snap.id) ?? {}) };
          return supabase
            .from("order_items")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ card_snapshot: merged as any })
            .eq("id", (row as { id: string }).id);
        })
      );

      await supabase.from("cards").update({ status: "sold" }).in("id", cardIds);
      await supabase.from("cart_items").delete().in("id", selectedItems.map((i) => i.id));
      await supabase.from("profiles").update({ balance: Number(profile.balance) - total }).eq("id", user.id);
      await supabase.from("transactions").insert({ user_id: user.id, amount: -total, kind: "purchase", note: `Order ${order.id}` });
      toast.success(`Order placed — $${total.toFixed(2)}`);
      await refresh();
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally { setBusy(false); }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-black neon-text">CART</h1>
            <p className="text-sm text-muted-foreground mt-1">{items.length} item(s) · {selectedItems.length} selected</p>
          </div>
          <div className="glass-neon rounded-xl px-4 py-3 flex items-center gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Selected total</p>
              <p className="font-display text-2xl font-bold neon-text">${total.toFixed(2)}</p>
            </div>
            <Button onClick={checkout} disabled={busy || total === 0} className="bg-gradient-primary shadow-neon">
              <CreditCard className="h-4 w-4 mr-2" />Pay all
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Your cart is empty. Browse the Shop to add cards.</p>
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 w-10"></th>
                  <th className="p-3 text-left">Brand</th>
                  <th className="p-3 text-left">BIN</th>
                  <th className="p-3 text-left">Country</th>
                  <th className="p-3 text-left">Exp</th>
                  <th className="p-3 text-left">Base</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-border/40 hover:bg-secondary/30 transition">
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)}
                        className="accent-primary h-4 w-4" />
                    </td>
                    <td className="p-3"><BrandLogo brand={it.card.brand} /></td>
                    <td className="p-3 font-mono">{it.card.bin}••••</td>
                    <td className="p-3">{countryFlag(it.card.country)} {it.card.country}</td>
                    <td className="p-3">{it.card.exp_month}/{it.card.exp_year}</td>
                    <td className="p-3 text-xs text-muted-foreground">{it.card.base}</td>
                    <td className="p-3 text-right font-display font-bold text-primary-glow">${Number(it.card.price).toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-destructive transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Cart;
