import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { sellerAppsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Clock, XCircle, Send, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Application {
  id: string; status: "pending" | "approved" | "rejected";
  telegram: string | null; jabber: string | null; expected_volume: string | null;
  sample_bins: string | null; message: string | null; admin_note: string | null;
  created_at: string; reviewed_at: string | null;
}

const SellerApply = () => {
  const { user, roles } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [isSeller, setIsSeller] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ telegram: "", jabber: "", expected_volume: "", sample_bins: "", message: "" });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { applications } = await sellerAppsApi.mine();
      setApps((applications ?? []) as unknown as Application[]);
      setIsSeller(roles.includes("seller") || roles.includes("admin"));
    } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const submit = async () => {
    if (!user) return;
    if (!form.telegram && !form.jabber) return toast.error("Provide at least Telegram or Jabber");
    try {
      await sellerAppsApi.submit({ ...form, status: "pending" });
      toast.success("Application submitted — admin will review shortly");
      setForm({ telegram: "", jabber: "", expected_volume: "", sample_bins: "", message: "" });
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Submit failed"); }
  };

  const pending = apps.find((a) => a.status === "pending");
  const latest = apps[0];

  return (
    <AppShell>
      <div className="space-y-5 max-w-3xl">
        <div>
          <h1 className="font-display text-3xl font-black neon-text">BECOME A SELLER</h1>
          <p className="text-sm text-muted-foreground mt-1">Apply to list cards on the marketplace.</p>
        </div>

        {isSeller && (
          <section className="glass-neon rounded-2xl p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="font-display text-lg text-foreground">You're already approved</p>
                <p className="text-xs text-muted-foreground">Head over to your seller dashboard to start listing.</p>
              </div>
            </div>
            <Link to="/seller">
              <Button className="bg-gradient-primary shadow-neon">Open dashboard <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </Link>
          </section>
        )}

        {!isSeller && pending && (
          <section className="glass rounded-2xl p-6 border border-warning/40">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-5 w-5 text-warning" />
              <h2 className="font-display tracking-wider text-warning">UNDER REVIEW</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Submitted {new Date(pending.created_at).toLocaleString()}. We'll notify you once an admin reviews it.
            </p>
          </section>
        )}

        {!isSeller && !pending && latest?.status === "rejected" && (
          <section className="glass rounded-2xl p-6 border border-destructive/40">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <h2 className="font-display tracking-wider text-destructive">PREVIOUS APPLICATION REJECTED</h2>
            </div>
            {latest.admin_note && <p className="text-sm text-muted-foreground mb-2">Admin note: {latest.admin_note}</p>}
            <p className="text-xs text-muted-foreground">You may submit a new application below.</p>
          </section>
        )}

        {!isSeller && !pending && (
          <section className="glass-neon rounded-2xl p-6 space-y-4">
            <h2 className="font-display tracking-wider text-primary-glow">APPLICATION</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Telegram"><Input value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} placeholder="@yourhandle" className="bg-input/60" /></Field>
              <Field label="Jabber / OTR"><Input value={form.jabber} onChange={(e) => setForm({ ...form, jabber: e.target.value })} placeholder="you@xmpp.org" className="bg-input/60" /></Field>
              <Field label="Expected daily volume"><Input value={form.expected_volume} onChange={(e) => setForm({ ...form, expected_volume: e.target.value })} placeholder="e.g. 500 cards / day" className="bg-input/60" /></Field>
              <Field label="Sample BINs"><Input value={form.sample_bins} onChange={(e) => setForm({ ...form, sample_bins: e.target.value })} placeholder="411111, 545454, 379282" className="bg-input/60" /></Field>
            </div>
            <Field label="Why should we approve you?">
              <Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Tell us about your sources, refund policy, experience…" className="bg-input/60" />
            </Field>
            <Button onClick={submit} className="bg-gradient-primary shadow-neon">
              <Send className="h-4 w-4 mr-2" />Submit application
            </Button>
          </section>
        )}

        {apps.length > 0 && (
          <section className="glass rounded-2xl p-6">
            <h2 className="font-display tracking-wider text-primary-glow mb-3">HISTORY</h2>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <div className="space-y-2">
                {apps.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/40">
                    <div>
                      <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                      {a.telegram && <p className="text-sm font-mono">{a.telegram}</p>}
                    </div>
                    <Badge className={
                      a.status === "approved" ? "bg-success/20 text-success border-success/40" :
                      a.status === "rejected" ? "bg-destructive/20 text-destructive border-destructive/40" :
                      "bg-warning/20 text-warning border-warning/40"
                    } variant="outline">{a.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

export default SellerApply;
