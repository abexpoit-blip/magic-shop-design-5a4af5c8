import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { depositsApi, depositAddressesApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bitcoin, Wallet, CheckCircle2, Copy, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

interface DepositAddress { id: string; method: string; address: string; network: string | null; }
interface Deposit { id: string; amount: number; method: string; txid: string | null; status: string; created_at: string; }

const Recharge = () => {
  const { profile } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("USDT");
  const [txid, setTxid] = useState("");
  const [busy, setBusy] = useState(false);
  const [addresses, setAddresses] = useState<DepositAddress[]>([]);
  const [history, setHistory] = useState<Deposit[]>([]);

  const load = async () => {
    const [a, d] = await Promise.allSettled([
      depositAddressesApi.list(),
      depositsApi.mine(),
    ]);
    if (a.status === "fulfilled") setAddresses((a.value.addresses ?? []) as DepositAddress[]);
    if (d.status === "fulfilled") setHistory((d.value.deposits ?? []) as Deposit[]);
  };
  useEffect(() => { load(); }, []);

  const current = addresses.find((a) => a.method === method);

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt < 20) return toast.error("Minimum recharge is $20");
    if (!txid.trim()) return toast.error("Transaction ID (TXID) is required");
    setBusy(true);
    try {
      await depositsApi.submit({ amount: amt, method, note: txid.trim() });
      toast.success("Deposit submitted. Admin will confirm shortly.");
      setAmount(""); setTxid("");
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Submit failed"); }
    finally { setBusy(false); }
  };

  const copy = (txt: string) => { navigator.clipboard.writeText(txt); toast.success("Address copied"); };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <h1 className="font-display text-3xl font-black neon-text">RECHARGE CENTER</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="glass-neon rounded-2xl p-6">
            <div className="flex items-center gap-2 text-primary-glow mb-3">
              <Wallet className="h-5 w-5" />
              <h2 className="font-display tracking-wider">YOUR BALANCE</h2>
            </div>
            <p className="font-display text-5xl font-black neon-text mb-6">${Number(profile?.balance ?? 0).toFixed(2)}</p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {["USDT", "BTC", "LTC"].map((m) => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`px-3 py-2 rounded-lg border text-sm font-display tracking-wider transition ${
                    method === m ? "bg-primary/20 border-primary text-primary-glow" : "bg-secondary/40 border-border/50 text-foreground/70 hover:border-primary/40"
                  }`}>{m}</button>
              ))}
            </div>

            {current && (
              <div className="p-3 rounded-lg bg-background/60 border border-primary/30 mb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{current.network ?? current.method} address</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs text-primary-glow break-all flex-1">{current.address}</code>
                  <button onClick={() => copy(current.address)} className="text-muted-foreground hover:text-primary-glow shrink-0">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <label className="text-xs uppercase tracking-wider text-muted-foreground">Amount sent (USD)</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={20}
              placeholder="20" className="mt-1.5 bg-input/60 text-2xl font-display h-14" />

            <label className="text-xs uppercase tracking-wider text-muted-foreground mt-3 block">Transaction ID (TXID)</label>
            <Input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="Paste your TXID for verification" className="mt-1.5 bg-input/60 font-mono text-xs" />

            <Button onClick={submit} disabled={busy} className="mt-4 w-full bg-gradient-primary shadow-neon h-12">
              <Bitcoin className="h-4 w-4 mr-2" /> Submit deposit for review
            </Button>
            <p className="text-xs text-muted-foreground mt-3">Send funds to the address above, paste TXID, submit. Admin confirms within 5–30 mins.</p>
          </section>

          <section className="glass rounded-2xl p-6">
            <h2 className="font-display tracking-wider mb-3 text-primary-glow">TOP-UP BONUS</h2>
            <ul className="space-y-2.5">
              {[["$500", "$35 bonus"], ["$1,000", "$100 bonus"], ["$2,000", "$240 bonus"], ["$5,000", "$750 bonus"]].map(([a, b]) => (
                <li key={a} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/40">
                  <span className="font-display text-foreground">{a}</span>
                  <span className="text-primary-glow font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />{b}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-4">Bonus credited automatically when admin confirms your deposit.</p>
          </section>
        </div>

        <section className="glass rounded-2xl p-6">
          <h3 className="font-display tracking-wider mb-3 text-primary-glow">RECENT DEPOSITS</h3>
          <div className="space-y-2">
            {history.length === 0 && <p className="text-sm text-muted-foreground">No deposits yet.</p>}
            {history.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/40">
                <div>
                  <p className="font-display text-foreground">${Number(d.amount).toFixed(2)} <span className="text-xs text-muted-foreground">· {d.method}</span></p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[260px] sm:max-w-md">{d.txid}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                  d.status === "approved" ? "bg-success/20 text-success" :
                  d.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
                }`}>
                  {d.status === "approved" ? <CheckCircle2 className="h-3 w-3" /> : d.status === "rejected" ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
};

export default Recharge;
