import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi, refundsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Undo2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface RefundRequest {
  id: string; buyer_id: string; seller_id: string; card_id: string | null;
  kind: string; reason: string | null; status: string; created_at: string;
  resolved_at?: string | null; card?: { bin?: string; brand?: string; price?: number };
  buyer?: { username?: string }; seller?: { username?: string };
}

const AdminRefunds = () => {
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [tab, setTab] = useState<"pending" | "history">("pending");

  const load = async () => {
    try {
      const { refunds: rf } = await refundsApi.all();
      setRefunds((rf ?? []) as unknown as RefundRequest[]);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, []);

  const decide = async (r: RefundRequest, approve: boolean) => {
    try {
      await refundsApi.decide(r.id, approve);
      toast.success(approve ? "Refund approved & credited" : "Refund rejected");
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const counts = useMemo(() => ({
    pending: refunds.filter((r) => r.status === "pending").length,
    approved: refunds.filter((r) => r.status === "approved").length,
    rejected: refunds.filter((r) => r.status === "rejected").length,
  }), [refunds]);

  const list = tab === "pending"
    ? refunds.filter((r) => r.status === "pending")
    : refunds.filter((r) => r.status !== "pending");

  return (
    <AdminLayout title="Refund Requests">
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Undo2 className="h-4 w-4 text-primary-glow" />
          <h2 className="font-display tracking-wider text-primary-glow">REFUND / REPLACE QUEUE</h2>
          <div className="ml-auto flex gap-2">
            {(["pending", "history"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider transition ${
                  tab === t ? "bg-primary/20 border border-primary/60 text-primary-glow" : "bg-secondary/40 border border-border/40 text-muted-foreground hover:bg-secondary/60"
                }`}>{t === "pending" ? `Pending (${counts.pending})` : `History (${counts.approved + counts.rejected})`}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
          <Stat label="Pending" value={counts.pending} tone="warning" />
          <Stat label="Approved" value={counts.approved} tone="success" />
          <Stat label="Rejected" value={counts.rejected} tone="muted" />
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests in this view.</p>
        ) : (
          <div className="space-y-2">
            {list.map((r) => (
              <div key={r.id} className="flex items-start justify-between p-4 rounded-lg bg-secondary/40 border border-border/40 flex-wrap gap-3">
                <div className="text-sm min-w-0 flex-1">
                  <p>
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                      r.kind === "refund" ? "bg-warning/20 text-warning border-warning/40" : "bg-primary/20 text-primary-glow border-primary/40"
                    }`}>{r.kind?.toUpperCase()}</span>
                    {" "}buyer: {r.buyer?.username ?? r.buyer_id?.slice(0, 8)}
                    {" · seller: "}{r.seller?.username ?? r.seller_id?.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Card: {r.card ? `${r.card.brand} ${r.card.bin}` : "n/a"}
                    {r.card?.price && <> · <span className="text-primary-glow">${Number(r.card.price).toFixed(2)}</span></>}
                  </p>
                  {r.reason && <p className="text-xs italic text-muted-foreground mt-1">"{r.reason}"</p>}
                  <p className="text-[10px] mt-1">
                    status: <span className={r.status === "pending" ? "text-warning" : r.status === "approved" ? "text-success" : "text-destructive"}>{r.status}</span>
                    {" · "}{new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(r, true)} className="bg-success text-white">
                      <Check className="h-3 w-3 mr-1" />Approve & credit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => decide(r, false)}>
                      <X className="h-3 w-3 mr-1" />Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminLayout>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: number; tone: "warning" | "success" | "muted" }) => {
  const color = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-muted-foreground";
  return (
    <div className="rounded-lg bg-secondary/30 border border-border/40 p-3">
      <p className={`font-display text-xl ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
    </div>
  );
};

export default AdminRefunds;
