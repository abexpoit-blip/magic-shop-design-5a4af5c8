import { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { NavLink, useLocation } from "react-router-dom";
import { Shield, LayoutDashboard, Users, CreditCard, Wallet, Undo2 } from "lucide-react";

interface Item { to: string; label: string; icon: React.ComponentType<{ className?: string }>; }

const items: Item[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/applications", label: "Applications", icon: Users },
  { to: "/admin/payouts", label: "Payouts & Commission", icon: Wallet },
  { to: "/admin/cards", label: "Card moderation", icon: CreditCard },
  { to: "/admin/refunds", label: "Refund requests", icon: Undo2 },
];

export const AdminLayout = ({ children, title }: { children: ReactNode; title: string }) => {
  const { pathname } = useLocation();
  return (
    <AppShell>
      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-60 lg:shrink-0">
          <div className="glass rounded-2xl p-4 lg:sticky lg:top-4">
            <div className="flex items-center gap-2 mb-4 px-2">
              <Shield className="h-5 w-5 text-primary-glow" />
              <span className="font-display tracking-wider text-primary-glow text-sm">ADMIN</span>
            </div>
            <nav className="space-y-1">
              {items.map((it) => {
                const active = it.to === "/admin" ? pathname === "/admin" : pathname.startsWith(it.to);
                const Icon = it.icon;
                return (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                      active
                        ? "bg-primary/15 text-primary-glow border border-primary/40"
                        : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground border border-transparent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{it.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>
        <div className="flex-1 min-w-0 space-y-6">
          <h1 className="font-display text-2xl font-black neon-text">{title}</h1>
          {children}
        </div>
      </div>
    </AppShell>
  );
};
