import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Check, X, BadgeCheck, Eye, EyeOff, UserCheck, Search } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string; username: string; balance: number; is_seller: boolean;
  is_seller_verified?: boolean; is_seller_visible?: boolean;
  commission_percent?: number; seller_display_name?: string | null;
}
interface Payout { id: string; seller_id: string; amount: number; method: string; address: string; status: string; created_at: string; paid_at?: string | null; }

const AdminPayouts = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [selectedPayouts, setSelectedPayouts] = useState<Set<string>>(new Set());
  const [payoutBulkRunning, setPayoutBulkRunning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  const load = async () => {
    const [u, p] = await Promise.all([
      supabase.from("profiles")
        .select("id,username,balance,is_seller,is_seller_verified,is_seller_visible,commission_percent,seller_display_name")
        .eq("is_seller", true).order("created_at", { ascending: false }).limit(500),
      supabase.from("payouts").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setUsers((u.data ?? []) as Profile[]);
    setPayouts((p.data ?? []) as Payout[]);
  };
  useEffect(() => { load(); }, []);

  const decidePayout = async (p: Payout, paid: boolean) => {
    await supabase.from("payouts").update({
      status: paid ? "paid" : "rejected",
      paid_at: paid ? new Date().toISOString() : null,
    }).eq("id", p.id);
    toast.success(paid ? "Marked as paid" : "Payout rejected");
    load();
  };

  const updateSeller = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await (supabase.from("profiles") as any).update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Seller updated");
    load();
  };

  const filteredSellers = useMemo(() => {
    const q = query.toLowerCase();
    return users.filter((u) =>
      !q || u.username.toLowerCase().includes(q) || (u.seller_display_name ?? "").toLowerCase().includes(q)
    );
  }, [users, query]);

  const toggleOne = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = filteredSellers.length > 0 && filteredSellers.every((u) => selected.has(u.id));
  const someSelected = filteredSellers.some((u) => selected.has(u.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) filteredSellers.forEach((u) => n.delete(u.id));
      else filteredSellers.forEach((u) => n.add(u.id));
      return n;
    });

  const bulkApply = async (patch: Record<string, unknown>, label: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkRunning(true);
    const { error } = await (supabase.from("profiles") as any).update(patch).in("id", ids);
    setBulkRunning(false);
    if (error) return toast.error(error.message);
    toast.success(`${label} → ${ids.length}`);
    setSelected(new Set());
    load();
  };

  const pending = payouts.filter((p) => p.status === "pending");
  const history = payouts.filter((p) => p.status !== "pending");

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
                  tab === t ? "bg-primary/20 border border-primary/60 text-primary-glow" : "bg-secondary/40 border border-border/40 text-muted-foreground hover:bg-secondary/60"
                }`}>{t === "pending" ? `Pending (${pending.length})` : `History (${history.length})`}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {(tab === "pending" ? pending : history).map((p) => {
            const u = users.find((x) => x.id === p.seller_id);
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/40 border border-border/40 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-display">
                    ${Number(p.amount).toFixed(2)} · <span className="text-primary-glow">{p.method}</span>
                    <span className="text-xs text-muted-foreground"> · {u?.seller_display_name || u?.username || p.seller_id.slice(0, 8)}</span>
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{p.address}</p>
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
            );
          })}
          {(tab === "pending" ? pending : history).length === 0 && (
            <p className="text-sm text-muted-foreground">No {tab === "pending" ? "pending payouts" : "history"} yet.</p>
          )}
        </div>
      </section>

      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <UserCheck className="h-4 w-4 text-primary-glow" />
          <h2 className="font-display tracking-wider text-primary-glow">COMMISSION & SELLER STATUS</h2>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sellers…" className="bg-input/60 pl-9" />
        </div>

        {selected.size > 0 && (
          <div className="mb-3 p-3 rounded-xl bg-primary/10 border border-primary/40 flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm text-primary-glow">{selected.size} selected</span>
            <Button size="sm" disabled={bulkRunning} onClick={() => bulkApply({ is_seller_visible: true }, "Make visible")} className="bg-success/20 text-success border border-success/40 hover:bg-success/30">
              <Eye className="h-3.5 w-3.5 mr-1" />Make visible
            </Button>
            <Button size="sm" disabled={bulkRunning} variant="outline" onClick={() => bulkApply({ is_seller_visible: false }, "Hide")}>
              <EyeOff className="h-3.5 w-3.5 mr-1" />Hide
            </Button>
            <Button size="sm" disabled={bulkRunning} onClick={() => bulkApply({ is_seller_verified: true }, "Verify")} className="bg-primary/20 text-primary-glow border border-primary/40 hover:bg-primary/30">
              <BadgeCheck className="h-3.5 w-3.5 mr-1" />Verify
            </Button>
            <Button size="sm" disabled={bulkRunning} variant="outline" onClick={() => bulkApply({ is_seller_verified: false }, "Unverify")}>
              <X className="h-3.5 w-3.5 mr-1" />Unverify
            </Button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input type="checkbox" checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                    onChange={toggleAll} className="accent-primary cursor-pointer" />
                </th>
                <th className="p-3 text-left">Seller</th>
                <th className="p-3 text-center">Verified</th>
                <th className="p-3 text-center">Visible</th>
                <th className="p-3 text-center">Commission %</th>
              </tr>
            </thead>
            <tbody>
              {filteredSellers.map((u) => (
                <tr key={u.id} className={`border-t border-border/40 ${selected.has(u.id) ? "bg-primary/5" : ""}`}>
                  <td className="p-3 text-center">
                    <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} className="accent-primary cursor-pointer" />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.seller_display_name || u.username}</span>
                      {u.is_seller_verified && <BadgeCheck className="h-3.5 w-3.5 text-primary-glow" />}
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground">@{u.username}</p>
                  </td>
                  <td className="p-3 text-center">
                    <Toggle checked={!!u.is_seller_verified} onChange={(v) => updateSeller(u.id, { is_seller_verified: v })} />
                  </td>
                  <td className="p-3 text-center">
                    <Toggle checked={!!u.is_seller_visible} onChange={(v) => updateSeller(u.id, { is_seller_visible: v })} />
                  </td>
                  <td className="p-3 text-center">
                    <Input type="number" min={0} max={100} step={0.5}
                      defaultValue={Number(u.commission_percent ?? 20)}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== Number(u.commission_percent ?? 20)) updateSeller(u.id, { commission_percent: v });
                      }}
                      className="w-20 mx-auto bg-input/60 text-center" />
                  </td>
                </tr>
              ))}
              {filteredSellers.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-xs">No sellers match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
};

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${checked ? "bg-primary" : "bg-secondary border border-border"}`}>
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-1"}`} />
  </button>
);

export default AdminPayouts;
