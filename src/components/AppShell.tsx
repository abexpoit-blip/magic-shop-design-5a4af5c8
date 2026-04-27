import { ReactNode, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, Store, ShoppingCart, ListOrdered, Wallet, LifeBuoy, Settings, ShieldCheck, PackagePlus, LogOut, Menu, X, Search, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/panther-logo.png";
import { Button } from "@/components/ui/button";

const baseNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/shop", label: "Marketplace", icon: Store },
  { to: "/cart", label: "Cart", icon: ShoppingCart },
  { to: "/orders", label: "Orders", icon: ListOrdered },
  { to: "/recharge", label: "Wallet", icon: Wallet },
  { to: "/tickets", label: "Support", icon: LifeBuoy },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { profile, roles, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const items = [...baseNav];
  if (roles.includes("seller") || roles.includes("admin")) {
    items.splice(5, 0, { to: "/seller", label: "Seller", icon: PackagePlus });
  }
  if (roles.includes("admin")) {
    items.push({ to: "/admin", label: "Admin", icon: ShieldCheck });
  }

  const isActive = (to: string) => to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);

  return (
    <div className="min-h-screen flex flex-col w-full bg-background relative">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-gradient-glow opacity-60" />

      {/* Announcement bar */}
      <div className="relative z-40 border-b border-border/40 bg-black/40 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-12 py-2 text-[11px] font-mono tracking-[0.18em] text-muted-foreground whitespace-nowrap">
          <div className="ticker shrink-0 gap-12 flex pl-6">
            {Array.from({ length: 2 }).map((_, k) => (
              <div key={k} className="flex gap-12">
                <span><span className="text-primary-glow">●</span> LIVE INVENTORY · 12,400+ FRESH CARDS</span>
                <span className="text-gold/80">★ VERIFIED SELLERS · INSTANT DELIVERY</span>
                <span><span className="text-success">●</span> 99.4% VALID RATE THIS WEEK</span>
                <span className="text-gold/80">↗ AUTO REPLACEMENT WITHIN 5 MINUTES</span>
                <span><span className="text-primary-glow">●</span> SUPPORT 24/7 · @CRUZERCC_SUPPORT</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto max-w-[1500px] px-6 lg:px-10 h-[84px] flex items-center justify-between gap-10">
          {/* Brand */}
          <NavLink to="/" className="flex items-center gap-3.5 group shrink-0">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-primary/30 blur-xl group-hover:bg-primary/50 transition" />
              <img src={logo} alt="cruzercc.shop" width={44} height={44}
                className="relative h-11 w-11 drop-shadow-[0_0_18px_hsl(268_90%_62%/0.65)]" />
            </div>
            <div className="leading-none">
              <div className="font-display text-[20px] font-semibold tracking-[-0.02em]">
                <span className="text-foreground">cruzer</span><span className="gold-text">cc</span>
                <span className="text-muted-foreground/80">.shop</span>
              </div>
              <div className="font-mono text-[9.5px] tracking-[0.36em] text-muted-foreground/60 mt-1.5">
                GIFT&nbsp;CARD · CC&nbsp;PROVIDER
              </div>
            </div>
          </NavLink>

          {/* Desktop nav pills */}
          <nav className="hidden lg:flex items-center gap-0.5 bg-secondary/25 border border-border/40 rounded-full px-1.5 py-1.5">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/"}
                className="nav-pill"
                data-active={isActive(it.to)}
              >
                <it.icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
                <span>{it.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button className="hidden md:flex h-11 w-11 items-center justify-center rounded-full border border-border/50 hover:border-primary/40 hover:text-primary-glow text-muted-foreground transition" aria-label="Search">
              <Search className="h-[15px] w-[15px]" strokeWidth={1.75} />
            </button>
            <button className="hidden md:flex h-11 w-11 items-center justify-center rounded-full border border-border/50 hover:border-primary/40 hover:text-primary-glow text-muted-foreground transition relative" aria-label="Notifications">
              <Bell className="h-[15px] w-[15px]" strokeWidth={1.75} />
              <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
            </button>

            <div className="hidden sm:flex items-center gap-2.5 pl-4 pr-5 h-11 rounded-full bg-gradient-to-r from-primary/15 to-gold/10 border border-primary/30">
              <Wallet className="h-[15px] w-[15px] text-primary-glow" strokeWidth={1.75} />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Balance</span>
              <span className="font-display font-semibold text-[15px] gold-text">${Number(profile?.balance ?? 0).toFixed(2)}</span>
            </div>

            <NavLink to="/settings" className="flex items-center gap-3 h-11 pl-1.5 pr-4 rounded-full border border-border/50 hover:border-primary/40 transition group">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-[12px] font-semibold text-primary-foreground shadow-neon">
                {profile?.username?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="hidden xl:block leading-tight pr-1">
                <div className="text-[13px] font-semibold text-foreground -mb-0.5">{profile?.username}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-[0.22em]">
                  {roles.includes("admin") ? "Admin" : roles.includes("seller") ? "Seller" : "Member"}
                </div>
              </div>
            </NavLink>

            <button onClick={async () => { await signOut(); nav("/auth"); }}
              className="hidden md:flex h-11 w-11 items-center justify-center rounded-full border border-border/50 hover:border-destructive/50 hover:text-destructive text-muted-foreground transition" aria-label="Sign out">
              <LogOut className="h-[15px] w-[15px]" strokeWidth={1.75} />
            </button>

            <button onClick={() => setOpen(!open)} className="lg:hidden h-11 w-11 flex items-center justify-center rounded-full border border-border/50" aria-label="Menu">
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="lg:hidden border-t border-border/50 bg-background/95 backdrop-blur-2xl animate-fade-up">
            <div className="px-4 py-4 grid grid-cols-2 gap-2">
              {items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.to === "/"} onClick={() => setOpen(false)}
                  className={({ isActive }) => `flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition ${
                    isActive ? "bg-primary/15 text-primary-glow border border-primary/30" : "bg-secondary/40 border border-border/40 text-muted-foreground"
                  }`}>
                  <it.icon className="h-4 w-4" /> {it.label}
                </NavLink>
              ))}
              <button onClick={async () => { await signOut(); nav("/auth"); }}
                className="col-span-2 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium bg-destructive/10 text-destructive border border-destructive/30">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 mx-auto w-full max-w-[1500px] px-4 lg:px-8 py-8 animate-fade-up relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/40 bg-black/30 backdrop-blur-xl mt-16">
        <div className="mx-auto max-w-[1500px] px-4 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <img src={logo} alt="" className="h-8 w-8" />
              <div className="font-display font-bold text-base">
                <span>cruzer</span><span className="gold-text">cc</span><span className="text-muted-foreground">.shop</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              Premium Gift Card and CC marketplace. Verified inventory, instant delivery, vault-grade
              security — trusted by thousands of professional buyers worldwide.
            </p>
          </div>
          <div>
            <h4 className="font-display text-xs uppercase tracking-[0.25em] text-foreground mb-3">Platform</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>Marketplace</li><li>Wallet & Recharge</li><li>Seller Program</li><li>Refund Policy</li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-xs uppercase tracking-[0.25em] text-foreground mb-3">Contact</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li><span className="gold-text">@cruzercc_shop</span></li>
              <li><span className="gold-text">@cruzercc_sales</span></li>
              <li><span className="gold-text">@cruzercc_support</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/40 py-4 text-center text-[10px] font-mono tracking-[0.3em] text-muted-foreground">
          © {new Date().getFullYear()} CRUZERCC.SHOP · ALL RIGHTS RESERVED
        </div>
      </footer>
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
