// Live backend reachability indicator. Pings /api/health on mount and every
// 15s; surfaces "Backend Connected" or "Auth API Offline" so the user can tell
// at a glance whether the API is reachable from the browser.

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/api";

type Status = "checking" | "online" | "offline";

const HEALTH_URL = buildApiUrl("/health");
const POLL_MS = 15_000;

export const ApiHealthBadge = () => {
  const [status, setStatus] = useState<Status>("checking");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      const started = performance.now();
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(HEALTH_URL, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        clearTimeout(timeout);
        if (cancelled) return;
        const contentType = res.headers.get("content-type") ?? "";
        if (!res.ok || !contentType.includes("application/json")) {
          setStatus("offline");
          setLatency(null);
          return;
        }
        setLatency(Math.round(performance.now() - started));
        setStatus("online");
      } catch {
        if (!cancelled) {
          setStatus("offline");
          setLatency(null);
        }
      }
    };

    ping();
    const id = setInterval(ping, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const variants = {
    checking: {
      ring: "border-border/60 bg-secondary/30 text-muted-foreground",
      dot: "bg-muted-foreground animate-pulse",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: "CHECKING API",
      sub: "",
    },
    online: {
      ring: "border-success/40 bg-success/10 text-success",
      dot: "bg-success shadow-[0_0_8px_hsl(var(--success))]",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: "BACKEND CONNECTED",
      sub: latency != null ? `${latency} ms` : "",
    },
    offline: {
      ring: "border-destructive/50 bg-destructive/10 text-destructive",
      dot: "bg-destructive animate-pulse",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: "AUTH API OFFLINE",
      sub: "retry in 15s",
    },
  } as const;

  const v = variants[status];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-md ${v.ring}`}
      role="status"
      aria-live="polite"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} aria-hidden />
      {v.icon}
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold">
        {v.label}
      </span>
      {v.sub && (
        <span className="font-mono text-[10px] text-muted-foreground/80">· {v.sub}</span>
      )}
    </div>
  );
};
