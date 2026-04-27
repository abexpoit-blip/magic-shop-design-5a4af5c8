import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Wallet, ShoppingBag, TrendingUp, Megaphone, Newspaper, Send } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const { profile } = useAuth();
  const [news, setNews] = useState<{ id: string; label: string; count: number }[]>([]);
  const [anns, setAnns] = useState<{ id: string; title: string; body: string }[]>([]);
  const [stats, setStats] = useState({ orders: 0, spend: 0 });

  useEffect(() => {
    (async () => {
      const [n, a, o] = await Promise.all([
        supabase.from("news_updates").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("orders").select("total"),
      ]);
      setNews((n.data ?? []) as typeof news);
      setAnns((a.data ?? []) as typeof anns);
      const orders = (o.data ?? []) as { total: number }[];
      setStats({ orders: orders.length, spend: orders.reduce((s, x) => s + Number(x.total), 0) });
    })();
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Hero stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={Wallet} label="Wallet balance" value={`$${Number(profile?.balance ?? 0).toFixed(2)}`}
            cta={<Link to="/recharge" className="text-xs text-primary-glow hover:underline">Recharge →</Link>} />
          <StatCard icon={ShoppingBag} label="Total orders" value={String(stats.orders)} />
          <StatCard icon={TrendingUp} label="Total spent" value={`$${stats.spend.toFixed(2)}`} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* News */}
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Newspaper className="h-4 w-4 text-primary-glow" />
              <h2 className="font-display font-bold tracking-wider">NEWS &amp; UPDATES</h2>
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin space-y-2 pr-2">
              {news.map((n) => (
                <div key={n.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 border border-border/40 hover:border-primary/40 transition group">
                  <span className="text-sm text-foreground/80 group-hover:text-primary-glow transition">{n.label}</span>
                  <span className="text-xs font-display text-primary-glow">×{n.count}</span>
                </div>
              ))}
              {news.length === 0 && <p className="text-sm text-muted-foreground">No updates yet.</p>}
            </div>
          </section>

          {/* Announcements */}
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="h-4 w-4 text-primary-glow" />
              <h2 className="font-display font-bold tracking-wider">ANNOUNCEMENTS</h2>
            </div>
            <div className="space-y-3">
              {anns.map((a) => (
                <div key={a.id} className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20">
                  <h3 className="font-display font-semibold text-primary-glow mb-1">{a.title}</h3>
                  <p className="text-sm text-foreground/80 leading-relaxed">{a.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Rules + contact */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="glass rounded-2xl p-6">
            <h2 className="font-display font-bold tracking-wider mb-4">SHOP RULES</h2>
            <ul className="space-y-2 text-sm text-foreground/80 list-disc pl-5 marker:text-primary">
              <li>By registering, you automatically agree to the rules of the store.</li>
              <li>Rules can be changed without notifying users.</li>
              <li>If you find bugs or vulnerabilities, report them via tickets.</li>
              <li>Exploiting bugs for profit will result in a permanent ban.</li>
              <li>After clearing the orders section, the team cannot recover purchased cards. Save cards to your device.</li>
              <li>Account balance is non-refundable. Recharge reasonably.</li>
            </ul>
          </section>
          <section className="glass rounded-2xl p-6">
            <h2 className="font-display font-bold tracking-wider mb-4">CONTACT</h2>
            <p className="text-sm text-muted-foreground mb-4">Beware of fake support — only contact us through the channels below.</p>
            <div className="space-y-2">
              <ContactRow label="Telegram channel" value="@scorpionccstore01" />
              <ContactRow label="Sales" value="@Scorpion_ccsale" />
              <ContactRow label="Support" value="@scorpioncc_shop_002" />
            </div>
            <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm text-primary-glow flex items-center gap-2">
              <Send className="h-4 w-4" /> Sellers welcome — apply via Seller Panel after registration.
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
};

const StatCard = ({ icon: Icon, label, value, cta }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; cta?: React.ReactNode }) => (
  <div className="glass rounded-2xl p-5 relative overflow-hidden group hover:border-primary/40 transition">
    <div className="absolute -right-6 -top-6 h-24 w-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition" />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-3xl font-bold mt-2 neon-text">{value}</p>
        {cta && <div className="mt-2">{cta}</div>}
      </div>
      <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary-glow" />
      </div>
    </div>
  </div>
);

const ContactRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 border border-border/40">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-primary-glow">{value}</span>
  </div>
);

export default Index;
