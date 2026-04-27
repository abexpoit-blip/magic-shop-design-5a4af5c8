import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Check, X, BadgeCheck, Eye, EyeOff, UserCheck, Search, ArrowUpDown, RotateCcw } from "lucide-react";
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

  // Filters & sort for the payout list
  const [payoutQuery, setPayoutQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "rejected">("all");
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortBy, setSortBy] = useState<"created_desc" | "created_asc" | "amount_desc" | "amount_asc">("created_desc");

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

  const togglePayout = (id: string) =>
    setSelectedPayouts((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const undoBulk = async (snapshot: Array<{ id: string; status: string; paid_at: string | null }>) => {
    // Restore each row's prior status/paid_at. Small batch — N updates.
    const results = await Promise.all(
      snapshot.map((s) =>
        supabase.from("payouts").update({ status: s.status, paid_at: s.paid_at }).eq("id", s.id),
      ),
    );
    const failed = results.filter((r) => r.error).length;
    if (failed > 0) toast.error(`Undo partially failed (${failed}/${snapshot.length})`);
    else toast.success(`Reverted ${snapshot.length} payout${snapshot.length === 1 ? "" : "s"}`);
    load();
  };

  const bulkPayoutAction = async (paid: boolean) => {
    const ids = Array.from(selectedPayouts);
    if (ids.length === 0) return;
    const verb = paid ? `mark ${ids.length} payout(s) as paid` : `reject ${ids.length} payout(s)`;
    if (!confirm(`Confirm: ${verb}?`)) return;

    // Snapshot prior state of only the rows we'll actually change (status === pending)
    const target = payouts.filter((p) => ids.includes(p.id) && p.status === "pending");
    const snapshot = target.map((p) => ({ id: p.id, status: p.status, paid_at: p.paid_at ?? null }));

    setPayoutBulkRunning(true);
    const { error } = await supabase.from("payouts").update({
      status: paid ? "paid" : "rejected",
      paid_at: paid ? new Date().toISOString() : null,
    }).in("id", ids).eq("status", "pending");
    setPayoutBulkRunning(false);
    if (error) return toast.error(error.message);

    setSelectedPayouts(new Set());
    load();

    if (snapshot.length === 0) {
      toast.message("No pending payouts were affected");
      return;
    }

    toast.success(`${paid ? "Marked paid" : "Rejected"}: ${snapshot.length}`, {
      duration: 10000,
      action: {
        label: "Undo",
        onClick: () => undoBulk(snapshot),
      },
    });
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

  // Sellers that have at least one payout — used to populate the seller filter
  const payoutSellers = useMemo(() => {
    const ids = Array.from(new Set(payouts.map((p) => p.seller_id)));
    return ids.map((id) => {
      const u = users.find((x) => x.id === id);
      return { id, label: u?.seller_display_name || u?.username || id.slice(0, 8) };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [payouts, users]);

  const filteredPayouts = useMemo(() => {
    const q = payoutQuery.trim().toLowerCase();
    const min = minAmount ? Number(minAmount) : null;
    const max = maxAmount ? Number(maxAmount) : null;
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86_399_999 : null; // include end-of-day

    let list = payouts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (sellerFilter !== "all" && p.seller_id !== sellerFilter) return false;
      const created = new Date(p.created_at).getTime();
      if (fromTs !== null && created < fromTs) return false;
      if (toTs !== null && created > toTs) return false;
      const amt = Number(p.amount);
      if (min !== null && amt < min) return false;
      if (max !== null && amt > max) return false;
      if (q) {
        const u = users.find((x) => x.id === p.seller_id);
        const blob = `${u?.username ?? ""} ${u?.seller_display_name ?? ""} ${p.method} ${p.address}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "created_asc": return +new Date(a.created_at) - +new Date(b.created_at);
        case "amount_desc": return Number(b.amount) - Number(a.amount);
        case "amount_asc": return Number(a.amount) - Number(b.amount);
        default: return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
    return list;
  }, [payouts, users, payoutQuery, statusFilter, sellerFilter, dateFrom, dateTo, minAmount, maxAmount, sortBy]);

  const pending = filteredPayouts.filter((p) => p.status === "pending");
  const history = filteredPayouts.filter((p) => p.status !== "pending");

  const filtersActive = !!(payoutQuery || statusFilter !== "all" || sellerFilter !== "all" || dateFrom || dateTo || minAmount || maxAmount || sortBy !== "created_desc");
  const resetFilters = () => {
    setPayoutQuery(""); setStatusFilter("all"); setSellerFilter("all");
    setDateFrom(""); setDateTo(""); setMinAmount(""); setMaxAmount("");
    setSortBy("created_desc");
  };

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

        {/* Filters & sorting */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={payoutQuery} onChange={(e) => setPayoutQuery(e.target.value)}
              placeholder="Search seller, method, address…" className="bg-input/60 pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="bg-input/60"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger className="bg-input/60"><SelectValue placeholder="Seller" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sellers</SelectItem>
              {payoutSellers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2 items-center">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-input/60" />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-input/60" />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Min&nbsp;$</label>
            <Input type="number" step="0.01" min="0" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="bg-input/60" />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Max&nbsp;$</label>
            <Input type="number" step="0.01" min="0" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="bg-input/60" />
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="bg-input/60">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_desc">Newest first</SelectItem>
              <SelectItem value="created_asc">Oldest first</SelectItem>
              <SelectItem value="amount_desc">Amount high → low</SelectItem>
              <SelectItem value="amount_asc">Amount low → high</SelectItem>
            </SelectContent>
          </Select>

          {filtersActive && (
            <Button variant="outline" onClick={resetFilters} className="lg:col-span-1">
              <RotateCcw className="h-3.5 w-3.5 mr-1" />Reset filters
            </Button>
          )}
        </div>

        {tab === "pending" && pending.length > 0 && (
          <div className="mb-3 flex items-center gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPayouts.size === pending.length}
                ref={(el) => { if (el) el.indeterminate = selectedPayouts.size > 0 && selectedPayouts.size < pending.length; }}
                onChange={() => setSelectedPayouts(selectedPayouts.size === pending.length ? new Set() : new Set(pending.map((p) => p.id)))}
                className="accent-primary cursor-pointer"
              />
              Select all pending ({pending.length})
            </label>
            {selectedPayouts.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                <span className="text-xs text-primary-glow font-display">
                  {selectedPayouts.size} selected · ${pending.filter((p) => selectedPayouts.has(p.id)).reduce((s, p) => s + Number(p.amount), 0).toFixed(2)}
                </span>
                <Button size="sm" disabled={payoutBulkRunning} onClick={() => bulkPayoutAction(true)} className="bg-success text-white">
                  <Check className="h-3.5 w-3.5 mr-1" />Mark all paid
                </Button>
                <Button size="sm" disabled={payoutBulkRunning} variant="destructive" onClick={() => bulkPayoutAction(false)}>
                  <X className="h-3.5 w-3.5 mr-1" />Reject all
                </Button>
                <button onClick={() => setSelectedPayouts(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          {(tab === "pending" ? pending : history).map((p) => {
            const u = users.find((x) => x.id === p.seller_id);
            return (
              <div key={p.id} className={`flex items-center gap-2 p-3 rounded-lg border flex-wrap transition ${
                selectedPayouts.has(p.id) ? "bg-primary/10 border-primary/40" : "bg-secondary/40 border-border/40"
              }`}>
                {p.status === "pending" && (
                  <input type="checkbox" checked={selectedPayouts.has(p.id)} onChange={() => togglePayout(p.id)} className="accent-primary cursor-pointer" />
                )}
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
