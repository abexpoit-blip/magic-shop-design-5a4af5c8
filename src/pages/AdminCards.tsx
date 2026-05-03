import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { cardsApi, adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, Trash2, Search, EyeOff, Eye, DollarSign, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Card {
  id: string; seller_id: string; bin: string; brand: string; country: string;
  price: number; status: string; created_at: string;
}

const AdminCards = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "sold" | "hidden">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = { limit: 200 };
      if (statusFilter !== "all") params.status = statusFilter;
      if (query) params.q = query;
      const { cards: c } = await cardsApi.browse(params);
      setCards((c ?? []) as unknown as Card[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [query, statusFilter]);

  const toggleOne = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = cards.length > 0 && cards.every((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) cards.forEach((c) => n.delete(c.id));
      else cards.forEach((c) => n.add(c.id));
      return n;
    });

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} cards?`)) return;
    try {
      await cardsApi.bulkDelete(ids);
      toast.success(`Deleted ${ids.length}`);
      setSelected(new Set()); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const bulkSetStatus = async (status: "available" | "hidden") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      await cardsApi.bulkUpdate(ids, { status });
      toast.success(`Status → ${status} on ${ids.length} cards`);
      setSelected(new Set()); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const [bulkPrice, setBulkPrice] = useState("");
  const bulkSetPrice = async () => {
    const ids = Array.from(selected);
    const p = Number(bulkPrice);
    if (ids.length === 0 || !p || p <= 0) return toast.error("Select cards and enter a valid price");
    try {
      await cardsApi.bulkUpdate(ids, { price: p });
      toast.success(`Price → $${p.toFixed(2)} on ${ids.length} cards`);
      setBulkPrice(""); setSelected(new Set()); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const saveEdit = async (id: string) => {
    const p = Number(editPrice);
    if (!p || p <= 0) return toast.error("Invalid price");
    try {
      await cardsApi.update(id, { price: p });
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, price: p } : c)));
      setEditingId(null);
      toast.success("Price updated");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const removeOne = async (id: string) => {
    if (!confirm("Delete this card?")) return;
    try {
      await cardsApi.del(id);
      setCards((cs) => cs.filter((c) => c.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <AdminLayout title="Card Moderation">
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <CreditCard className="h-4 w-4 text-primary-glow" />
          <h2 className="font-display tracking-wider text-primary-glow">ALL CARDS ({cards.length})</h2>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search BIN / brand / country…" className="bg-input/60 pl-9" />
          </div>
          <div className="flex gap-1">
            {(["all", "available", "sold", "hidden"] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-lg text-xs uppercase tracking-wider transition ${
                  statusFilter === s ? "bg-primary/20 border border-primary/60 text-primary-glow" : "bg-secondary/40 border border-border/40 text-muted-foreground"
                }`}>{s}</button>
            ))}
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mb-3 p-3 rounded-xl bg-primary/10 border border-primary/40 flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm text-primary-glow">{selected.size} selected</span>
            <Button size="sm" onClick={() => bulkSetStatus("available")} className="bg-success/20 text-success border border-success/40"><Eye className="h-3.5 w-3.5 mr-1" />Show</Button>
            <Button size="sm" variant="outline" onClick={() => bulkSetStatus("hidden")}><EyeOff className="h-3.5 w-3.5 mr-1" />Hide</Button>
            <Button size="sm" variant="destructive" onClick={bulkDelete}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border/40">
              <DollarSign className="h-3.5 w-3.5 text-primary-glow" />
              <Input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} type="number" step="0.01" placeholder="New price" className="bg-input/60 h-8 w-28 text-xs" />
              <Button size="sm" onClick={bulkSetPrice} className="bg-gradient-primary">Set price</Button>
            </div>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground">Clear</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="p-2 w-10 text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-primary" /></th>
                <th className="p-2 text-left">BIN</th>
                <th className="p-2 text-left">Brand</th>
                <th className="p-2 text-left">Country</th>
                <th className="p-2 text-right">Price</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} className={`border-t border-border/40 ${selected.has(c.id) ? "bg-primary/5" : ""} hover:bg-secondary/20`}>
                  <td className="p-2 text-center"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} className="accent-primary" /></td>
                  <td className="p-2 font-mono">{c.bin}</td>
                  <td className="p-2">{c.brand}</td>
                  <td className="p-2">{c.country}</td>
                  <td className="p-2 text-right text-primary-glow font-display">
                    {editingId === c.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} type="number" step="0.01"
                          className="bg-input/60 h-7 w-20 text-xs text-right" autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(c.id); if (e.key === "Escape") setEditingId(null); }} />
                        <button onClick={() => saveEdit(c.id)} className="text-success"><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingId(c.id); setEditPrice(String(c.price)); }} className="hover:underline">${Number(c.price).toFixed(2)}</button>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                      c.status === "available" ? "bg-success/20 text-success border-success/40" :
                      c.status === "sold" ? "bg-secondary text-muted-foreground border-border" : "bg-warning/20 text-warning border-warning/40"
                    }`}>{c.status}</span>
                  </td>
                  <td className="p-2 text-right">
                    <button onClick={() => removeOne(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {!loading && cards.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground text-xs">No cards match filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
};

export default AdminCards;
