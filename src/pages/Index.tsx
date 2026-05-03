import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { newsApi, announcementsApi, ordersApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Wallet, ShoppingBag, TrendingUp, Megaphone, Newspaper, Send,
  ShieldCheck, Zap, Globe2, ArrowRight, Sparkles, BadgeCheck,
  Crown, Flame, Lock
} from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const Index = () => {
  const { profile } = useAuth();
  const settings = useSiteSettings();
  const [news, setNews] = useState<{ id: string; label: string; count: number }[]>([]);
  const [anns, setAnns] = useState<{ id: string; title: string; body: string }[]>([]);
  const [stats, setStats] = useState({ orders: 0, spend: 0 });

  useEffect(() => {
    (async () => {
      const [n, a, o] = await Promise.allSettled([
        newsApi.list(),
        announcementsApi.list(),
        ordersApi.mine(),
      ]);
      if (n.status === "fulfilled") setNews((n.value.updates ?? []) as typeof news);
      if (a.status === "fulfilled") setAnns((a.value.announcements ?? []) as typeof anns);
      if (o.status === "fulfilled") {
        const orders = (o.value.orders ?? []) as { total: number }[];
        setStats({ orders: orders.length, spend: orders.reduce((s, x) => s + Number(x.total), 0) });
      }
    })();
  }, []);

  return (
    <AppShell>
      <div className="space-y-12">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[28px] border border-border/50 bg-gradient-to-br from-card/80 via-card/40 to-background/60 backdrop-blur-2xl">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-primary/25 blur-[120px]" />
          <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-gold/15 blur-[120px]" />
          <div className="absolute inset-0 grid-bg opacity-30" />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 lg:p-14">
            <div className="lg:col-span-7 space-y-7">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-[11px] font-mono tracking-[0.2em] text-primary-glow">
                <Sparkles className="h-3 w-3" />
                {settings.hero_eyebrow} · {profile?.username?.toUpperCase() ?? "MEMBER"}
              </div>

              <h1 className="font-display font-extrabold leading-[1.05] tracking-[-0.03em] text-[44px] sm:text-[64px] lg:text-[80px] text-foreground">
                {settings.hero_title}
              </h1>

              <p className="text-base lg:text-lg text-muted-foreground max-w-xl leading-relaxed">
                {settings.hero_sub}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Link to="/shop" className="btn-luxe">
                  {settings.hero_cta} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/recharge" className="btn-ghost-luxe">
                  <Wallet className="h-4 w-4" /> Recharge wallet
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 max-w-xl">
                <FeaturePill icon={ShieldCheck} label="Vault-grade" />
                <FeaturePill icon={Zap} label="Instant" />
                <FeaturePill icon={Crown} label="Curated" />
              </div>
            </div>

            <div className="lg:col-span-5 flex items-center justify-center">
              <div className="relative w-full max-w-sm">
                <div className="absolute inset-0 bg-gradient-primary rounded-3xl blur-2xl opacity-40" />
                <div className="relative aspect-[1.6/1] rounded-3xl p-6 bg-gradient-to-br from-primary/40 via-primary/20 to-card border border-primary/40 shadow-card overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gold/30 blur-3xl" />
                  <div className="absolute inset-0 grid-bg opacity-20" />
                  <div className="relative flex flex-col h-full justify-between">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/70">Account balance</p>
                        <p className="font-display text-4xl font-bold text-foreground mt-1">
                          ${Number(profile?.balance ?? 0).toFixed(2)}
                        </p>
                      </div>
                      <Crown className="h-7 w-7 text-gold" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-mono tracking-widest text-foreground/80">
                        <Lock className="h-3 w-3" /> SECURE · ENCRYPTED · INSTANT
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-mono text-xs text-foreground/70">•••• •••• •••• {profile?.username?.slice(-4).toUpperCase() ?? "USER"}</span>
                        <span className="font-display font-bold text-sm gold-text">CRUZERCC</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* QUICK STATS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Wallet} label="Wallet balance" value={`$${Number(profile?.balance ?? 0).toFixed(2)}`} accent="violet" sub="Available now" />
          <StatCard icon={ShoppingBag} label="Total orders" value={String(stats.orders)} accent="gold" sub="Lifetime" />
          <StatCard icon={TrendingUp} label="Total spent" value={`$${stats.spend.toFixed(2)}`} accent="violet" sub="All-time volume" />
          <StatCard icon={Flame} label="Valid rate" value="99.4%" accent="gold" sub="Last 7 days" />
        </section>

        {/* CATEGORY SHOWCASE */}
        <section>
          <SectionHeader eyebrow="Shop by category" title="Premium card catalog" sub="Curated, verified, and ready to deploy." />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "VISA", grad: "from-[#1a1f71] to-[#0d1140]", tag: "Classic · Gold · Platinum" },
              { name: "Mastercard", grad: "from-[#eb001b] to-[#f79e1b]", tag: "Standard · World · Black" },
              { name: "Amex", grad: "from-[#006fcf] to-[#003d7a]", tag: "Green · Gold · Platinum" },
              { name: "Discover", grad: "from-[#ff6000] to-[#cc4d00]", tag: "More · It · Cashback" },
            ].map((b) => (
              <Link key={b.name} to="/shop" className="group relative aspect-[1.5/1] rounded-2xl overflow-hidden border border-border/60 hover:border-primary/50 transition">
                <div className={`absolute inset-0 bg-gradient-to-br ${b.grad} opacity-90 group-hover:opacity-100 transition`} />
                <div className="absolute inset-0 grid-bg opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="relative p-5 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono tracking-[0.3em] text-white/70 uppercase">Brand</span>
                    <BadgeCheck className="h-4 w-4 text-white/80" />
                  </div>
                  <div>
                    <div className="font-display text-2xl font-bold text-white tracking-tight">{b.name}</div>
                    <div className="text-[11px] text-white/70 mt-0.5">{b.tag}</div>
                    <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-white/90 group-hover:text-white">
                      Browse <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* NEWS + ANNOUNCEMENTS */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass rounded-3xl p-7">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <Newspaper className="h-4 w-4 text-primary-glow" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold tracking-tight">Live inventory updates</h2>
                  <p className="text-xs text-muted-foreground">Auto-refreshed every minute</p>
                </div>
              </div>
              <span className="hidden md:flex items-center gap-1.5 text-[10px] font-mono tracking-wider text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> LIVE
              </span>
            </div>
            <div className="max-h-[380px] overflow-y-auto scrollbar-thin space-y-1.5 pr-2">
              {news.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No updates yet.</p>}
              {news.map((n) => (
                <div key={n.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/40 hover:border-primary/40 hover:bg-secondary/50 transition group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-glow shrink-0" />
                    <span className="text-sm text-foreground/85 group-hover:text-foreground transition truncate font-mono">{n.label}</span>
                  </div>
                  <span className="text-xs font-display font-bold text-gold shrink-0 ml-3">×{n.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-gold rounded-3xl p-7">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-8 w-8 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
                  <Megaphone className="h-4 w-4 text-gold" />
                </div>
                <h2 className="font-display text-lg font-bold tracking-tight">Announcements</h2>
              </div>
              <div className="space-y-3 max-h-[320px] overflow-y-auto scrollbar-thin pr-1">
                {anns.length === 0 && <p className="text-sm text-muted-foreground">No announcements.</p>}
                {anns.map((a) => (
                  <div key={a.id} className="p-3.5 rounded-xl bg-gradient-to-br from-gold/10 to-transparent border border-gold/20">
                    <h3 className="font-display font-semibold text-gold mb-1 text-sm">{a.title}</h3>
                    <p className="text-xs text-foreground/75 leading-relaxed">{a.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* WHY US */}
        <section>
          <SectionHeader eyebrow="Why cruzercc.shop" title="Built for serious buyers" sub="A luxury operating system for high-volume cardholders." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: ShieldCheck, t: "Vault-grade trust", d: "Every seller manually vetted. Every card validity-checked at intake. Auto-refund if invalid on first use." },
              { icon: Zap, t: "Instant fulfillment", d: "Cards delivered to your secure dashboard the moment payment clears. No waiting. No back-and-forth." },
              { icon: Globe2, t: "Global coverage", d: "Inventory across 40+ countries with detailed BIN, ZIP, and issuer metadata for surgical targeting." },
            ].map((f) => (
              <div key={f.t} className="glass rounded-3xl p-7 hover:border-primary/40 transition group">
                <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-neon mb-5 group-hover:scale-110 transition">
                  <f.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-display text-xl font-bold mb-2 tracking-tight">{f.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* RULES + CONTACT */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-3xl p-7">
            <SmallHeader icon={ShieldCheck} title="Shop rules" />
            <ul className="space-y-3 text-sm text-foreground/80">
              {[
                "By registering, you automatically agree to the rules of the store.",
                "Rules can change without prior notice — review periodically.",
                "Report bugs or vulnerabilities through tickets — bounties available.",
                "Exploiting vulnerabilities for profit results in permanent ban.",
                "Save purchased cards immediately — orders cannot be recovered after deletion.",
                "Account balance is non-refundable. Recharge responsibly.",
              ].map((r, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-mono text-[11px] text-primary-glow mt-0.5 shrink-0">0{i + 1}</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-neon rounded-3xl p-7">
            <SmallHeader icon={Send} title="Official contact" />
            <p className="text-xs text-muted-foreground mb-4">Beware of impersonators — only contact us through verified channels below.</p>
            <div className="space-y-2.5">
              <ContactRow label="Telegram channel" value="@cruzercc_shop" />
              <ContactRow label="Sales" value="@cruzercc_sales" />
              <ContactRow label="Support" value="@cruzercc_support" />
            </div>
            <div className="mt-5 p-4 rounded-2xl bg-gradient-to-br from-gold/15 to-transparent border border-gold/30">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-4 w-4 text-gold" />
                <span className="font-display font-bold text-sm gold-text">Become a verified seller</span>
              </div>
              <p className="text-xs text-foreground/80">Apply through Settings after registration. Approved sellers receive automatic payouts and priority placement.</p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
};

const SectionHeader = ({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) => (
  <div className="mb-6 flex items-end justify-between gap-6 flex-wrap">
    <div>
      <div className="text-[10px] font-mono tracking-[0.3em] text-primary-glow uppercase mb-2">{eyebrow}</div>
      <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{sub}</p>
    </div>
    <div className="hidden md:block flex-1 max-w-[200px] divider-luxe" />
  </div>
);

const SmallHeader = ({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) => (
  <div className="flex items-center gap-2.5 mb-5">
    <div className="h-8 w-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
      <Icon className="h-4 w-4 text-primary-glow" />
    </div>
    <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
  </div>
);

const FeaturePill = ({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) => (
  <div className="group relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-secondary/20 px-4 py-4 backdrop-blur-xl transition-all hover:border-primary/50 hover:bg-secondary/40">
    <Icon className="h-5 w-5 text-primary-glow transition-transform group-hover:scale-110" />
    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/90">{label}</span>
  </div>
);

const StatCard = ({
  icon: Icon, label, value, sub, accent,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string; accent: "violet" | "gold" }) => {
  const isGold = accent === "gold";
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 glass group hover:border-primary/40 transition">
      <div className={`absolute -right-8 -top-8 h-24 w-24 ${isGold ? "bg-gold/15" : "bg-primary/15"} rounded-full blur-2xl group-hover:opacity-150 transition`} />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className={`font-display text-3xl font-bold mt-2 ${isGold ? "gold-text" : "neon-text"}`}>{value}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
        </div>
        <div className={`h-10 w-10 rounded-xl ${isGold ? "bg-gold/15 border-gold/30" : "bg-primary/15 border-primary/30"} border flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${isGold ? "text-gold" : "text-primary-glow"}`} />
        </div>
      </div>
    </div>
  );
};

const ContactRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/40">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="font-mono text-sm text-primary-glow">{value}</span>
  </div>
);

export default Index;
