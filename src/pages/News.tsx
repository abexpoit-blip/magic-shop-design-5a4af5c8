import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { newsApi } from "@/lib/api";
import { Newspaper, Calendar, AlertTriangle, Sparkles, Wrench, Bell, ChevronRight } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  body: string;
  type?: string;
  created_at: string;
}

const typeConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; gradient: string; border: string; badge: string; glow: string }> = {
  update: {
    label: "Update",
    icon: Bell,
    gradient: "from-primary/20 via-primary/10 to-transparent",
    border: "border-primary/30",
    badge: "bg-primary/20 text-primary-glow border-primary/40",
    glow: "shadow-[0_0_20px_-6px_hsl(268_90%_62%/0.3)]",
  },
  alert: {
    label: "Alert",
    icon: AlertTriangle,
    gradient: "from-red-500/15 via-red-500/5 to-transparent",
    border: "border-red-500/30",
    badge: "bg-red-500/20 text-red-400 border-red-500/40",
    glow: "shadow-[0_0_20px_-6px_rgba(239,68,68,0.3)]",
  },
  promo: {
    label: "Promotion",
    icon: Sparkles,
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    border: "border-amber-500/30",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    glow: "shadow-[0_0_20px_-6px_rgba(245,158,11,0.3)]",
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    gradient: "from-orange-500/15 via-orange-500/5 to-transparent",
    border: "border-orange-500/30",
    badge: "bg-orange-500/20 text-orange-400 border-orange-500/40",
    glow: "shadow-[0_0_20px_-6px_rgba(249,115,22,0.3)]",
  },
};

const News = () => {
  const [updates, setUpdates] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    newsApi.list().then((r) => setUpdates((r.updates ?? []) as unknown as NewsItem[])).finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="relative">
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/10 rounded-full blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_24px_-6px_hsl(268_90%_62%/0.4)]">
              <Newspaper className="h-6 w-6 text-primary-glow" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-black tracking-wider neon-text">NEWS & ANNOUNCEMENTS</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Stay updated with the latest from CruzerCC</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass rounded-2xl p-6 animate-pulse">
                <div className="h-4 w-20 bg-muted/30 rounded-full mb-3" />
                <div className="h-5 w-2/3 bg-muted/20 rounded mb-2" />
                <div className="h-3 w-1/4 bg-muted/10 rounded mb-4" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-muted/10 rounded" />
                  <div className="h-3 w-5/6 bg-muted/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : updates.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-border/40">
            <div className="h-16 w-16 rounded-2xl bg-muted/10 border border-border/40 flex items-center justify-center mx-auto mb-4">
              <Newspaper className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="font-display text-lg text-muted-foreground mb-1">No announcements yet</p>
            <p className="text-sm text-muted-foreground/60">Check back later for updates and news.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {updates.map((n, idx) => {
              const cfg = typeConfig[n.type || "update"] || typeConfig.update;
              const Icon = cfg.icon;
              const isLatest = idx === 0;

              return (
                <article
                  key={n.id}
                  className={`relative glass rounded-2xl overflow-hidden border transition-all hover:scale-[1.005] ${cfg.border} ${cfg.glow}`}
                >
                  {/* Gradient accent bar */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${cfg.gradient} pointer-events-none`} />

                  <div className="relative p-6">
                    {/* Top row: badge + date */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border backdrop-blur-sm ${cfg.badge}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                        {isLatest && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(n.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="font-display text-lg md:text-xl font-bold text-foreground tracking-wide leading-tight mb-3">
                      {n.title}
                    </h2>

                    {/* Body */}
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap border-t border-border/30 pt-3">
                      {n.body}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default News;
