import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { depositAddressesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Plus, Pencil, Power } from "lucide-react";
import { toast } from "sonner";

interface DepositAddr {
  id: string;
  method: string;
  address: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

const AdminDepositAddresses = () => {
  const [addrs, setAddrs] = useState<DepositAddr[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ method: "", address: "", label: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await depositAddressesApi.list();
      setAddrs((r.addresses ?? []) as unknown as DepositAddr[]);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.method.trim()) { toast.error("Method is required"); return; }
    if (!form.address.trim()) { toast.error("Address is required"); return; }
    setSubmitting(true);
    try {
      if (editId) {
        await depositAddressesApi.update(editId, {
          method: form.method.trim(),
          address: form.address.trim(),
          label: form.label.trim() || null,
        });
        toast.success("Address updated");
      } else {
        await depositAddressesApi.create({
          method: form.method.trim(),
          address: form.address.trim(),
          label: form.label.trim() || null,
        });
        toast.success("Address created");
      }
      setForm({ method: "", address: "", label: "" });
      setShowForm(false);
      setEditId(null);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSubmitting(false); }
  };

  const toggleActive = async (a: DepositAddr) => {
    try {
      await depositAddressesApi.update(a.id, { is_active: !a.is_active });
      toast.success(a.is_active ? "Deactivated" : "Activated");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const startEdit = (a: DepositAddr) => {
    setForm({ method: a.method, address: a.address, label: a.label ?? "" });
    setEditId(a.id);
    setShowForm(true);
  };

  return (
    <AdminLayout title="Deposit Addresses">
      <section className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary-glow" />
            <h2 className="font-display tracking-wider text-primary-glow">DEPOSIT ADDRESSES</h2>
          </div>
          <Button size="sm" onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ method: "", address: "", label: "" }); }}
            className="bg-primary/20 border border-primary/60 text-primary-glow hover:bg-primary/30">
            <Plus className="h-3.5 w-3.5 mr-1" />{showForm ? "Cancel" : "Add Address"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          These addresses are shown to buyers when they deposit. Deactivated addresses are hidden.
        </p>

        {showForm && (
          <div className="rounded-xl p-4 bg-secondary/40 border border-primary/30 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Method</label>
                <Input placeholder="BTC, USDT, LTC…" maxLength={50} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="bg-secondary/40 border-border/40" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Address</label>
                <Input placeholder="Wallet address" maxLength={500} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="bg-secondary/40 border-border/40" />
              </div>
            </div>
            <div className="max-w-xs">
              <label className="text-xs text-muted-foreground mb-1 block">Label (optional)</label>
              <Input placeholder="e.g. Main BTC wallet" maxLength={100} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="bg-secondary/40 border-border/40" />
            </div>
            <Button onClick={submit} disabled={submitting} size="sm">
              {submitting ? "Saving…" : editId ? "Update Address" : "Create Address"}
            </Button>
          </div>
        )}

        {addrs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deposit addresses configured yet.</p>
        ) : (
          <div className="space-y-2">
            {addrs.map((a) => (
              <div key={a.id} className={`flex items-center justify-between p-4 rounded-lg border flex-wrap gap-3 ${a.is_active ? "bg-secondary/40 border-border/40" : "bg-secondary/20 border-border/20 opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/20 border border-primary/40 text-primary-glow">{a.method}</span>
                    {a.label && <span className="text-xs text-muted-foreground">({a.label})</span>}
                    {!a.is_active && <span className="text-[10px] text-destructive uppercase">inactive</span>}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mt-1 break-all">{a.address}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(a)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => toggleActive(a)}
                    className={`h-7 w-7 ${a.is_active ? "text-success hover:text-success/80" : "text-destructive hover:text-destructive/80"}`}>
                    <Power className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminLayout>
  );
};

export default AdminDepositAddresses;
