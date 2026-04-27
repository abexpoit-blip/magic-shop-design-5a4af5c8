import { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, Store, ShoppingCart, ListOrdered, Wallet, LifeBuoy, Settings, ShieldCheck, PackagePlus, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/panther-logo.png";
import { Button } from "@/components/ui/button";

const baseNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/shop", label: "Shop", icon: Store },
  { to: "/cart", label: "Cart", icon: ShoppingCart },
  { to: "/orders", label: "Orders", icon: ListOrdered },
  { to: "/recharge", label: "Recharge", icon: Wallet },
  { to: "/tickets", label: "Support", icon: LifeBuoy },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { profile, roles, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const items = [...baseNav];
  if (roles.includes("seller") || roles.includes("admin")) {
    items.splice(5, 0, { to: "/seller", label: "Seller Panel", icon: PackagePlus });
  }
  if (roles.includes("admin")) {
    items.splice(items.length - 1, 0, { to: "/admin", label: "Admin", icon: ShieldCheck });
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border/60 bg-sidebar/80 backdrop-blur-xl sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-border/60">
          <img src={logo} alt="Scorpion Shop logo" className="h-9 w-9 drop-shadow-[0_0_12px_hsl(354_84%_52%/0.7)]" width={36} height={36} />
          <div>
            <div className="font-display text-lg font-black neon-text leading-none">SCORPION</div>
            <div className="text-[10px] tracking-[0.3em] text-muted-foreground mt-0.5">PREMIUM SHOP</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/"}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/30 shadow-[inset_0_0_12px_hsl(354_84%_52%/0.15)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`
              }
            >
              <it.icon className="h-4 w-4" />
              <span className="font-medium">{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border/60">
          <button
            onClick={async () => { await signOut(); nav("/auth"); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 px-4 md:px-8 flex items-center justify-between border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <div className="md:hidden flex items-center gap-2">
            <img src={logo} alt="" className="h-8 w-8 drop-shadow-[0_0_10px_hsl(268_90%_60%/0.6)]" width={32} height={32} />
            <span className="font-display font-black neon-text tracking-widest text-sm">BLACK PANTHER</span>
          </div>
          <div className="hidden md:block text-sm text-muted-foreground">
            {loc.pathname === "/" ? "Welcome back" : ""}
          </div>
          <div className="flex items-center gap-3">
            <div className="glass px-3 py-1.5 rounded-full flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary-glow" />
              <span className="text-xs text-muted-foreground">Balance</span>
              <span className="font-display font-bold text-primary-glow">${Number(profile?.balance ?? 0).toFixed(2)}</span>
            </div>
            <NavLink to="/settings" className="flex items-center gap-2 glass px-3 py-1.5 rounded-full hover:neon-border transition">
              <div className="h-6 w-6 rounded-full bg-gradient-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground">
                {profile?.username?.[0]?.toUpperCase() ?? "U"}
              </div>
              <span className="text-xs font-medium hidden sm:block">{profile?.username}</span>
            </NavLink>
          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/60 grid grid-cols-5">
          {items.slice(0, 5).map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === "/"}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[10px] ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 px-4 md:px-8 py-6 pb-24 md:pb-8 animate-fade-up">{children}</main>
      </div>
    </div>
  );
};

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) { nav("/auth"); return null; }
  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { roles, loading, user } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (!user || !roles.includes("admin"))
    return <div className="p-8"><Button onClick={() => history.back()}>Go back</Button><p className="mt-4">Admin access required.</p></div>;
  return <>{children}</>;
};
