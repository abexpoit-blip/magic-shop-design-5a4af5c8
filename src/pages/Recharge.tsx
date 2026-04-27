import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bitcoin, Wallet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const Recharge = () => {
  const { user, profile, refresh } = useAuth();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (method: "USDT" | "BTC/LTC") => {
    if (!user) return;
    const amt = Number(amount);
    if (!amt || amt < 20) return toast.error("Minimum recharge is $20");
    setBusy(true);
    try {
      // Demo: instant credit. Production should verify via webhook.
      let bonus = 0;
      if (amt >= 5000) bonus = 750;
      else if (amt >= 2000) bonus = 240;
      else if (amt >= 1000) bonus = 100;
      else if (amt >= 500) bonus = 35;
      const total = amt + bonus;

      await supabase.from("profiles").update({ balance: Number(profile?.balance ?? 0) + total }).eq("id", user.id);
      await supabase.from("transactions").insert({
        user_id: user.id, amount: total, kind: "recharge", method, note: bonus ? `Includes $${bonus} bonus` : null,
      });
      toast.success(`Recharged $${total.toFixed(2)}${bonus ? ` (incl. $${bonus} bonus)` : ""}`);
      await refresh();
      setAmount("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Recharge failed"); }
    finally { setBusy(false); }
  };

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

            <label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (USD)</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={20}
              placeholder="Enter amount" className="mt-1.5 bg-input/60 text-2xl font-display h-14" />

            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button onClick={() => submit("USDT")} disabled={busy} className="bg-gradient-primary shadow-neon h-12">
                <Bitcoin className="h-4 w-4 mr-2" /> USDT Pay
              </Button>
              <Button onClick={() => submit("BTC/LTC")} disabled={busy} variant="outline" className="border-primary/40 text-primary-glow h-12">
                <Bitcoin className="h-4 w-4 mr-2" /> BTC / LTC Pay
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">Minimum recharge is $20. Network fees deducted by your wallet.</p>
          </section>

          <section className="glass rounded-2xl p-6">
            <h2 className="font-display tracking-wider mb-3 text-primary-glow">TOP-UP PROMOTION</h2>
            <ul className="space-y-2.5">
              {[
                ["$500", "$35 bonus"], ["$1,000", "$100 bonus"], ["$2,000", "$240 bonus"], ["$5,000", "$750 bonus"],
              ].map(([a, b]) => (
                <li key={a} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/40">
                  <span className="font-display text-foreground">{a}</span>
                  <span className="text-primary-glow font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />{b}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-4">
              Send proof of recharge and your username to support if it does not credit automatically.
            </p>
          </section>
        </div>

        <section className="glass rounded-2xl p-6">
          <h3 className="font-display tracking-wider mb-3 text-primary-glow">SUPPORTED WALLETS</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {["Electrum", "BlueWallet", "Mycelium", "Samourai", "Wasabi", "Exodus", "Phoenix", "Breez", "Wallet of Satoshi", "Trust Wallet", "Atomic Wallet", "Coinomi"].map((w) => (
              <div key={w} className="px-3 py-2 rounded-lg bg-secondary/40 border border-border/40 text-foreground/80">{w}</div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
};

export default Recharge;
