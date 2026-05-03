import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { newsApi } from "@/lib/api";
import { Newspaper, Calendar } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

const News = () => {
  const [updates, setUpdates] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    newsApi.list().then((r) => setUpdates((r.updates ?? []) as NewsItem[])).finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Newspaper className="h-6 w-6 text-primary-glow" />
          <h1 className="font-display text-2xl tracking-wider text-primary-glow">NEWS & UPDATES</h1>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
        ) : updates.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Newspaper className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No news yet. Check back later!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {updates.map((n) => (
              <article key={n.id} className="glass rounded-2xl p-6 border border-border/40">
                <h2 className="font-display text-lg text-foreground tracking-wide">{n.title}</h2>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(n.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{n.body}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default News;
