import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { payoutsApi, adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Check, X, Search } from "lucide-react";
import { toast } from "sonner";

interface Payout { id: string; seller_id: string; amount: number; method: string; address?: string; destination?: string; status: string; created_at: string; paid_at?: string | null; seller_name?: string; }

const AdminPayouts = () => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [query, setQuery] = useState("");

  const load = async () => {
    try {
      const { payouts: p } = await payoutsApi.all();
      setPayouts((p ?? []) as unknown as Payout[]);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, []);

  const decidePayout = async (p: Payout, paid: boolean) => {
    try {
      if (paid) await payoutsApi.complete(p.id);
      else await payoutsApi.reject(p.id);
      toast.success(paid ? "Marked as paid" : "Payout rejected");
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payouts.filter((p) => {
      if (q && !`${p.seller_name ?? ""} ${p.method} ${p.destination ?? p.address ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [payouts, query]);

  const pending = filtered.filter((p) => p.status === "pending");
  const history = filtered.filter((p) => p.status !== "pending");

  return (
    <AdminLayout title="Payouts & Commission">
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-4 w-4 text-primary-glow" />
          <h2 className="font-display tracking-wider text-primary-glow">PAYOUT REQUESTS</h2>
          <div className="ml-auto flex gap-2">
            {(["pending", "history"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider transition ${
                  tab === t ? "bg-primary/20 border border-primary/60 text-primary-glow" : "bg-secondary/40 border border-border/40 text-muted-foreground"
                }`}>{t === "pending" ? `Pending (${pending.length})` : `History (${history.length})`}</button>
            ))}
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="bg-input/60 pl-9" />
        </div>

        <div className="space-y-2">
          {(tab === "pending" ? pending : history).map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/40 border border-border/40 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="font-display">
                  ${Number(p.amount).toFixed(2)} · <span className="text-primary-glow">{p.method}</span>
                  <span className="text-xs text-muted-foreground"> · {p.seller_name ?? p.seller_id?.slice(0, 8)}</span>
                </p>
                <p className="text-[10px] font-mono text-muted-foreground truncate">{p.destination ?? p.address}</p>
                <p className="text-[10px] text-muted-foreground">
                  requested {new Date(p.created_at).toLocaleString()}
                  {p.paid_at && ` · paid ${new Date(p.paid_at).toLocaleString()}`}
                </p>
              </div>
              {p.status === "pending" ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decidePayout(p, true)} className="bg-success text-white">
                    <Check className="h-3 w-3 mr-1" />Mark paid
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => decidePayout(p, false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  p.status === "paid" ? "bg-success/20 text-success border-success/40" : "bg-secondary/60 text-muted-foreground border-border"
                }`}>{p.status}</span>
              )}
            </div>
          ))}
          {(tab === "pending" ? pending : history).length === 0 && (
            <p className="text-sm text-muted-foreground">No {tab === "pending" ? "pending payouts" : "history"} yet.</p>
          )}
        </div>
      </section>
    </AdminLayout>
  );
};

export default AdminPayouts;
