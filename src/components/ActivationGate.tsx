import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { depositsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Lock, Sparkles, ShieldCheck, Zap, Wallet, Crown, ArrowRight, Loader2, Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

interface DepositRow {
  id: string;
  amount: number;
  status: string;
  method?: string;
  created_at?: string;
}

interface Props {
  children: React.ReactNode;
}

/**
 * Gates marketplace content behind a one-time activation deposit.
 * Sellers + admins bypass. Buyers must have at least one approved deposit
 * (current OR historical, even if balance is now 0).
 */
export const ActivationGate = ({ children }: Props) => {
  const { user, profile } = useAuth();
  const settings = useSiteSettings();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [activated, setActivated] = useState(false);
  const [latest, setLatest] = useState<DepositRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const bypass = !user || profile?.role === "admin" || profile?.role === "seller" || profile?.is_seller;

  const fetchDeposits = async () => {
    setRefreshing(true);
    try {
      const { deposits } = await depositsApi.mine();
      const list = (deposits ?? []) as unknown as DepositRow[];
      const ok = list.some((d) => {
        const s = String(d.status ?? "").toLowerCase();
        return s === "approved" || s === "completed";
      });
      const sorted = [...list].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
      setLatest(sorted[0] ?? null);
      setActivated(ok);
      setLastChecked(new Date());
      return ok;
    } catch {
      return false;
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (bypass) { setChecking(false); setActivated(true); return; }
    let alive = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      await fetchDeposits();
      if (!alive) return;
      setChecking(false);
      // Poll every 15s while not activated. Stop once approved.
      interval = setInterval(async () => {
        if (!alive) return;
        const ok = await fetchDeposits();
        if (ok && interval) { clearInterval(interval); interval = null; }
      }, 15000);
    })();

    const onFocus = () => { if (alive && !activated) fetchDeposits(); };
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      if (interval) clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bypass, user?.id]);

  if (checking) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (activated) return <>{children}</>;

  const min = Number(settings.min_deposit ?? 5);

  return (
    <AppShell>
      <div className="relative overflow-hidden">
        {/* Ambient glow orbs */}
        <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-accent/20 blur-[120px] animate-pulse" />

        <div className="relative max-w-4xl mx-auto py-8 md:py-12">
          {/* Eyebrow chip */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border border-primary/30 backdrop-blur-xl">
              <Crown className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Members Vault · Locked</span>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center space-y-3 mb-8">
            <h1 className="font-display text-4xl md:text-6xl font-black neon-text leading-tight">
              🔐 Activate Your Account
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              The marketplace is reserved for verified members. Make a one-time minimum deposit of{" "}
              <span className="font-bold text-primary">${min.toFixed(2)}</span> to unlock the vault — funds stay yours, ready to spend.
            </p>
          </div>

          {/* Premium glass card */}
          <div className="relative group">
            {/* Animated border gradient */}
            <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-r from-primary via-accent to-primary opacity-60 blur-sm group-hover:opacity-100 transition-opacity" />

            <div className="relative glass rounded-3xl p-6 md:p-10 border border-primary/30 bg-gradient-to-br from-card/95 via-card/80 to-card/95 backdrop-blur-2xl">
              {/* Top row: lock + amount */}
              <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl animate-pulse" />
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/40">
                    <Lock className="w-10 h-10 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground uppercase mb-1">
                    One-Time Activation
                  </div>
                  <div className="flex items-baseline justify-center md:justify-start gap-2">
                    <span className="text-5xl md:text-6xl font-display font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                      ${min.toFixed(2)}
                    </span>
                    <span className="text-sm text-muted-foreground font-medium">minimum</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    💰 Credited instantly to your wallet — no fees, no expiry
                  </div>
                </div>
              </div>

              {/* Deposit status panel — auto-refreshing */}
              {(() => {
                const status = String(latest?.status ?? "").toLowerCase();
                const cfg = !latest
                  ? { emoji: "💸", label: "No deposit yet", desc: "Make your first deposit to activate the marketplace.", tone: "border-border/50 bg-muted/20", pill: "bg-muted text-muted-foreground", pillText: "Awaiting", iconColor: "text-muted-foreground" }
                  : status === "approved" || status === "completed"
                  ? { emoji: "✅", label: "Deposit approved", desc: "Your account is now activated. Welcome aboard!", tone: "border-emerald-500/40 bg-emerald-500/5", pill: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40", pillText: "Approved", iconColor: "text-emerald-400" }
                  : status === "rejected" || status === "failed" || status === "expired" || status === "cancelled"
                  ? { emoji: "❌", label: "Deposit unsuccessful", desc: "Last attempt was not completed. Please try again.", tone: "border-destructive/40 bg-destructive/5", pill: "bg-destructive/20 text-destructive border border-destructive/40", pillText: status.charAt(0).toUpperCase() + status.slice(1), iconColor: "text-destructive" }
                  : { emoji: "⏳", label: "Deposit pending confirmation", desc: "We're waiting for network confirmation. This page updates automatically.", tone: "border-amber-500/40 bg-amber-500/5", pill: "bg-amber-500/20 text-amber-400 border border-amber-500/40", pillText: "Pending", iconColor: "text-amber-400" };
                const isApproved = status === "approved" || status === "completed";
                const isFailed = status === "rejected" || status === "failed" || status === "expired" || status === "cancelled";
                const isPending = !!latest && !isApproved && !isFailed;
                const StatusIcon = !latest ? Wallet : isApproved ? CheckCircle2 : isFailed ? XCircle : Clock;
                return (
                  <div className={`mb-6 rounded-2xl border ${cfg.tone} p-4 md:p-5 backdrop-blur-xl`}>
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        {isPending && <div className="absolute inset-0 rounded-xl bg-amber-500/30 blur-md animate-pulse" />}
                        <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-background/80 to-background/40 border border-border/60 flex items-center justify-center">
                          <StatusIcon className={`w-5 h-5 ${cfg.iconColor} ${isPending ? "animate-pulse" : ""}`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">Latest Deposit</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.pill}`}>
                            {isPending && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                            {cfg.pillText}
                          </span>
                        </div>
                        <div className="mt-1.5 text-sm font-bold text-foreground flex items-center gap-2">
                          <span>{cfg.emoji}</span>
                          <span>{cfg.label}</span>
                          {latest && (
                            <span className="ml-auto font-display text-base bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                              ${Number(latest.amount ?? 0).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{cfg.desc}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                          {latest?.method && <span className="uppercase tracking-wider">🪙 {latest.method}</span>}
                          {latest?.created_at && <span>📅 {new Date(latest.created_at).toLocaleString()}</span>}
                          {lastChecked && (
                            <span className="ml-auto flex items-center gap-1">
                              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                              <span>auto-refresh · {lastChecked.toLocaleTimeString()}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={fetchDeposits}
                        disabled={refreshing}
                        className="shrink-0 w-9 h-9 rounded-lg border border-border/60 hover:border-primary/50 hover:bg-primary/10 flex items-center justify-center transition-colors disabled:opacity-50"
                        aria-label="Refresh deposit status"
                      >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Feature grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {[
                  { icon: ShieldCheck, emoji: "🛡️", title: "Verified Status", desc: "Anti-fraud protection for the whole community" },
                  { icon: Zap, emoji: "⚡", title: "Instant Access", desc: "Unlocks the entire live inventory immediately" },
                  { icon: Wallet, emoji: "💎", title: "Wallet Credit", desc: "Every cent goes to your balance — spend anytime" },
                  { icon: Sparkles, emoji: "✨", title: "Premium Perks", desc: "Auto-replacement, priority support, member pricing" },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="group/item flex items-start gap-3 p-3.5 rounded-xl bg-gradient-to-br from-background/40 to-background/20 border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center text-lg group-hover/item:scale-110 transition-transform">
                      {f.emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        {f.title}
                      </div>
                      <div className="text-xs text-muted-foreground leading-snug mt-0.5">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => navigate("/recharge")}
                  className="flex-1 h-14 text-base font-bold tracking-wide bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] hover:bg-[position:100%_0] transition-[background-position] duration-500 shadow-xl shadow-primary/30 group/cta"
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  Deposit Now & Activate
                  <ArrowRight className="w-5 h-5 ml-2 group-hover/cta:translate-x-1 transition-transform" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/tickets")}
                  className="h-14 px-6 border-primary/30 hover:bg-primary/10"
                >
                  💬 Need Help?
                </Button>
              </div>

              {/* Trust strip */}
              <div className="mt-6 pt-5 border-t border-border/50 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">🔒 <span>Encrypted</span></span>
                <span className="flex items-center gap-1.5">⚡ <span>Instant Credit</span></span>
                <span className="flex items-center gap-1.5">🪙 <span>Crypto Accepted</span></span>
                <span className="flex items-center gap-1.5">♾️ <span>One-Time Only</span></span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            This is a one-time activation. Once your deposit is confirmed, the marketplace unlocks permanently. 🚀
          </p>
        </div>
      </div>
    </AppShell>
  );
};
