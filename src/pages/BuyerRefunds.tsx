import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { refundsApi, ordersApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Undo2, Plus, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Refund {
  id: string;
  order_id: string | null;
  card_id: string | null;
  amount: number;
  reason: string | null;
  status: string;
  resolution_note: string | null;
  created_at: string;
}

interface Order {
  id: string;
  total: number;
  created_at: string;
}

const BuyerRefunds = () => {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ order_id: "", amount: "", reason: "" });

  const load = async () => {
    const [r, o] = await Promise.allSettled([refundsApi.mine(), ordersApi.mine()]);
    if (r.status === "fulfilled") setRefunds((r.value.refunds ?? []) as unknown as Refund[]);
    if (o.status === "fulfilled") setOrders((o.value.orders ?? []) as unknown as Order[]);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (!form.reason.trim()) { toast.error("Please provide a reason"); return; }
    setSubmitting(true);
    try {
      await refundsApi.create({
        order_id: form.order_id || null,
        amount,
        reason: form.reason.trim(),
      });
      toast.success("Refund request submitted");
      setForm({ order_id: "", amount: "", reason: "" });
      setShowForm(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    } finally { setSubmitting(false); }
  };

  const statusIcon = (s: string) => {
    if (s === "pending") return <Clock className="h-3.5 w-3.5 text-warning" />;
    if (s === "approved") return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
    return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Undo2 className="h-6 w-6 text-primary-glow" />
            <h1 className="font-display text-2xl tracking-wider text-primary-glow">MY REFUNDS</h1>
          </div>
          <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-primary/20 border border-primary/60 text-primary-glow hover:bg-primary/30">
            <Plus className="h-3.5 w-3.5 mr-1" />{showForm ? "Cancel" : "New Request"}
          </Button>
        </div>

        {showForm && (
          <div className="glass rounded-2xl p-6 space-y-4 border border-primary/30">
            <h2 className="font-display tracking-wider text-sm text-primary-glow">SUBMIT REFUND REQUEST</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Related Order (optional)</label>
                <Select value={form.order_id} onValueChange={(v) => setForm({ ...form, order_id: v })}>
                  <SelectTrigger className="bg-secondary/40 border-border/40">
                    <SelectValue placeholder="Select order…" />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        ${Number(o.total).toFixed(2)} — {new Date(o.created_at).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Amount ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100000"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="bg-secondary/40 border-border/40"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Reason</label>
              <Textarea
                placeholder="Describe why you need a refund…"
                maxLength={1000}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="bg-secondary/40 border-border/40 min-h-[80px]"
              />
            </div>

            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? "Submitting…" : "Submit Refund Request"}
            </Button>
          </div>
        )}

        {refunds.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Undo2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No refund requests yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {refunds.map((r) => (
              <div key={r.id} className="glass rounded-xl p-4 border border-border/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {statusIcon(r.status)}
                      <span className="text-xs font-mono uppercase tracking-wider">{r.status}</span>
                      <span className="text-primary-glow font-display text-sm ml-auto">${Number(r.amount).toFixed(2)}</span>
                    </div>
                    {r.reason && <p className="text-xs text-muted-foreground mt-2 italic">"{r.reason}"</p>}
                    {r.resolution_note && (
                      <p className="text-xs mt-1 text-muted-foreground">
                        <span className="text-foreground/80">Admin note:</span> {r.resolution_note}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default BuyerRefunds;
