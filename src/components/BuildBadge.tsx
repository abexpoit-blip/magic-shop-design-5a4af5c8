// Build identity badge — shown on auth pages, admin login, and the app shell
// so we can verify at a glance which build is live in any environment.
//
// Values are injected at build time via Vite's `define` (see vite.config.ts).

declare const __BUILD_SHA__: string;
declare const __BUILD_TIME__: string;

export const BUILD_SHA: string =
  typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "dev";
export const BUILD_TIME: string =
  typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : new Date().toISOString();

export const BuildBadge = ({
  position = "fixed",
}: {
  position?: "fixed" | "inline";
}) => {
  const time = (() => {
    try {
      const d = new Date(BUILD_TIME);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return BUILD_TIME;
    }
  })();

  const cls =
    position === "fixed"
      ? "fixed bottom-3 right-3 z-50"
      : "inline-flex";

  return (
    <div
      className={`${cls} pointer-events-none select-none rounded-full border border-border/40 bg-black/60 px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground/80 backdrop-blur`}
      title={`Build ${BUILD_SHA} · ${BUILD_TIME}`}
      aria-label={`Build ${BUILD_SHA} ${time}`}
    >
      <span className="text-primary-glow">●</span>{" "}
      BUILD <span className="text-foreground/90">{BUILD_SHA}</span>
      <span className="opacity-60"> · {time}</span>
    </div>
  );
};
