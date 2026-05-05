import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ordersApi, cardsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface OrderItem { id?: string; price: number; card_snapshot?: Record<string, unknown>; card_id?: string; brand?: string; bin?: string; country?: string; last4?: string; city?: string; state?: string; zip?: string; base?: string; exp_month?: string; exp_year?: string; }
interface Order { id: string; total: number; status: string; created_at: string; order_items?: OrderItem[]; items?: OrderItem[]; }

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [q, setQ] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { orders: data } = await ordersApi.mine();
        setOrders((data ?? []) as unknown as Order[]);
      } catch { setOrders([]); }
    })();
  }, [user]);

  const getItems = (o: Order) => o.order_items ?? o.items ?? [];

  const download = async (o: Order) => {
    const items = getItems(o);
    const date = new Date(o.created_at);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    setDownloading(o.id);
    try {
      // Fetch full card data for each item via reveal endpoint
      const revealedCards = await Promise.all(
        items.map(async (it) => {
          try {
            if (it.card_id) {
              const { card } = await cardsApi.reveal(it.card_id);
              return { ...it, revealed: card };
            }
          } catch { /* card may be deleted, use snapshot */ }
          return { ...it, revealed: null };
        })
      );

      const lines = [
        `Order: ${o.id}`,
        `Date: ${date.toLocaleString()}`,
        `Total: $${Number(o.total).toFixed(2)}`,
        `Items: ${items.length}`,
        `Format: base|cc|month/year|cvv|name|address|city|state|zip|country|phonenumber|email|price`,
        `---`,
      ];

      for (const it of revealedCards) {
        const c = (it.revealed ?? it.card_snapshot ?? it) as Record<string, any>;
        const base = c.base ?? "N/A";
        const cc = c.cc_number ?? c.cc_data ?? "N/A";
        const month = c.exp_month != null ? String(c.exp_month).padStart(2, "0") : "null";
        const year = c.exp_year != null ? String(c.exp_year) : "null";
        const expiry = `${month}/${year}`;
        const cvv = c.cvv ?? "null";
        const name = c.holder_name ?? c.name ?? "null";
        const addr = c.address ?? c.addr ?? "null";
        const city = c.city ?? "null";
        const state = c.state ?? "null";
        const zip = c.zip ?? "null";
        const country = c.country ?? "null";
        const tel = c.phone ?? c.tel ?? "null";
        const email = c.email ?? "null";
        const price = `$${Number(it.price).toFixed(2)}`;
        lines.push(`${base}|${cc}|${expiry}|${cvv}|${name}|${addr}|${city}|${state}|${zip}|${country}|${tel}|${email}|${price}`);
      }

      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `order-${dateStr}-${o.id.slice(0, 8)}.txt`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Downloaded");
    } catch (e) {
      toast.error("Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const filtered = orders.filter((o) => o.id.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-black neon-text">ORDERS</h1>

        <div className="glass rounded-2xl p-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by order id" className="pl-10 bg-input/60" />
          </div>
        </div>

        <div className="glass rounded-2xl p-4 text-sm text-warning bg-warning/5 border-warning/20 border">
          ⚠️ Notice: Once cleared, orders cannot be recovered. Save your downloads to a safe place.
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Order</th>
                <th className="p-3 text-left">Items</th>
                <th className="p-3 text-left">Total</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border/40 hover:bg-secondary/30 transition">
                  <td className="p-3 font-mono text-xs">{o.id.slice(0, 16)}…</td>
                  <td className="p-3">{getItems(o).length}</td>
                  <td className="p-3 font-display text-primary-glow">${Number(o.total).toFixed(2)}</td>
                  <td className="p-3 text-muted-foreground">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => download(o)} disabled={downloading === o.id} className="border-primary/40 text-primary-glow">
                      <Download className="h-3 w-3 mr-1" /> {downloading === o.id ? "Loading…" : "Download"}
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
};

export default Orders;
