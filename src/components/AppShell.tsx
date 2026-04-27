import { ReactNode, useEffect, useState } from "react";
import { Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, Store, ShoppingCart, ListOrdered, Wallet, LifeBuoy, Settings, ShieldCheck, PackagePlus, LogOut, Menu, X, Search, Bell, Maximize2, Minimize2, AlertTriangle, RefreshCw, Repeat } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/panther-logo.png";
import { Button } from "@/components/ui/button";
import { BuildBadge } from "@/components/BuildBadge";
// Admin access is purely role-based (server-side via user_roles + RLS).

type Density = "comfortable" | "compact";

const baseNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/shop", label: "Marketplace", icon: Store },
  { to: "/cart", label: "Cart", icon: ShoppingCart },
  { to: "/orders", label: "Orders", icon: ListOrdered },
  { to: "/recharge", label: "Wallet", icon: Wallet },
  { to: "/tickets", label: "Support", icon: LifeBuoy },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { profile, roles, activeRole, setActiveRole, signOut, loading, user, profileError, refresh } = useAuth();
  const isPrimaryAdmin = (user?.email ?? "").toLowerCase() === PRIMARY_ADMIN_EMAIL;
  const canSell = roles.includes("seller") || roles.includes("admin") || isPrimaryAdmin;
  // Effective mode honours the user's pick at login but falls back safely for
  // accounts that don't actually carry the seller role.
  const effectiveRole: "buyer" | "seller" = activeRole === "seller" && canSell ? "seller" : "buyer";
  const roleLabel = isPrimaryAdmin || roles.includes("admin")
    ? "Admin"
    : effectiveRole === "seller"
    ? "Seller"
    : canSell
    ? "Buyer" // multi-role account currently shopping as a buyer
    : "Member";
  // Skeleton ONLY while genuinely fetching for a logged-in user with no error.
  // The hook guarantees `loading` flips to false within 8s (timeout) so this
  // can never be stuck "true" forever.
  const profileLoading = loading && !profile && !!user && !profileError;
  const showProfileError = !!profileError && !!user && !profile;
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "comfortable";
    return (localStorage.getItem("nav-density") as Density) || "comfortable";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
    localStorage.setItem("nav-density", density);
  }, [density]);

  const items = [...baseNav];
  // Only surface the Seller panel link when the user is currently in seller mode
  // (or is an admin). Buyers in buyer-mode shouldn't see the seller nav even if
  // their account also holds the seller role.
  if ((effectiveRole === "seller" && canSell) || roles.includes("admin") || isPrimaryAdmin) {
    items.splice(5, 0, { to: "/seller", label: "Seller", icon: PackagePlus });
  }
  if (roles.includes("admin") || isPrimaryAdmin) {
    items.push({ to: "/admin", label: "Admin", icon: ShieldCheck });
  }

  const isActive = (to: string) => to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);

  return (
    <div className="min-h-screen flex flex-col w-full bg-background relative">
      <BuildBadge />
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
      <header className="nav-header sticky top-0 z-40 border-b border-border/40 bg-background/75 backdrop-blur-2xl">
        <div className="nav-inner mx-auto max-w-[1500px] flex items-center justify-between">
          {/* Brand */}
          <NavLink to="/" className="nav-brand flex items-center group shrink-0">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-primary/30 blur-xl group-hover:bg-primary/50 transition-all duration-500" />
              <img src={logo} alt="cruzercc.shop" width={44} height={44}
                className="nav-brand-logo relative drop-shadow-[0_0_18px_hsl(268_90%_62%/0.65)] transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="leading-none ml-3 sm:ml-3.5">
              <div className="nav-brand-name font-display font-semibold tracking-[-0.02em]">
                <span className="text-foreground">cruzer</span><span className="gold-text">cc</span>
                <span className="text-muted-foreground/80">.shop</span>
              </div>
              <div className="nav-brand-tag font-mono text-muted-foreground/60 mt-1 sm:mt-1.5">
                GIFT&nbsp;CARD · CC&nbsp;PROVIDER
              </div>
            </div>
          </NavLink>

          {/* Desktop nav pills */}
          <nav className="nav-pills hidden lg:flex items-center bg-secondary/25 border border-border/40 rounded-full">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/"}
                className="nav-pill"
                data-active={isActive(it.to)}
              >
                <it.icon className="nav-pill-icon" strokeWidth={1.75} />
                <span>{it.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right cluster */}
          <div className="nav-right flex items-center shrink-0">
            <button className="nav-icon-btn hidden md:inline-flex !text-foreground/90 hover:!text-primary-glow" aria-label="Search">
              <Search className="nav-icon" strokeWidth={2} />
            </button>
            <button className="nav-icon-btn hidden md:inline-flex relative !text-foreground/90 hover:!text-primary-glow" aria-label="Notifications">
              <Bell className="nav-icon" strokeWidth={2} />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-gold animate-pulse ring-2 ring-background" />
            </button>

            <button
              onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
              className="nav-icon-btn inline-flex !text-foreground/90 hover:!text-primary-glow"
              aria-label={`Switch to ${density === "compact" ? "comfortable" : "compact"} density`}
              title={density === "compact" ? "Switch to comfortable" : "Switch to compact"}
            >
              {density === "compact" ? <Maximize2 className="nav-icon" strokeWidth={2} /> : <Minimize2 className="nav-icon" strokeWidth={2} />}
            </button>

            {showProfileError ? (
              <button
                onClick={() => { void refresh(); }}
                title={profileError ?? "Profile unavailable"}
                className="hidden sm:flex items-center gap-2 rounded-full border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-destructive hover:bg-destructive/20 transition-colors"
                aria-label={`Profile error: ${profileError}. Click to retry.`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] font-semibold">
                  Profile unavailable
                </span>
                <RefreshCw className="h-3 w-3" />
              </button>
            ) : (
              <div className="nav-balance hidden sm:flex items-center rounded-full bg-gradient-to-r from-primary/25 to-gold/15 border border-primary/50 shadow-[0_0_18px_-6px_hsl(268_90%_62%/0.6)]">
                <Wallet className="nav-icon text-primary-glow" strokeWidth={2} />
                <span className="nav-balance-label uppercase tracking-[0.2em] text-foreground/70">Balance</span>
                {profileLoading ? (
                  <span className="nav-balance-value nav-skeleton nav-skeleton-balance" aria-hidden="true" />
                ) : (
                  <span className="nav-balance-value font-display font-bold gold-text drop-shadow-[0_0_8px_hsl(43_96%_56%/0.5)]">${Number(profile?.balance ?? 0).toFixed(2)}</span>
                )}
              </div>
            )}

            <NavLink to="/settings" className="nav-profile flex items-center rounded-full border border-primary/40 bg-secondary/30 hover:border-primary/70 hover:bg-secondary/50 transition-colors group" aria-label="Profile settings">
              {showProfileError ? (
                <div className="nav-profile-avatar rounded-full bg-destructive/20 border border-destructive/60 flex items-center justify-center text-destructive font-bold" title={profileError ?? ""}>
                  !
                </div>
              ) : profileLoading ? (
                <span className="nav-profile-avatar nav-skeleton rounded-full" aria-hidden="true" />
              ) : (
                <div className="nav-profile-avatar rounded-full bg-gradient-primary flex items-center justify-center font-bold text-primary-foreground shadow-neon transition-transform duration-300 group-hover:scale-105">
                  {profile?.username?.[0]?.toUpperCase() ?? "U"}
                </div>
              )}
              <div className="hidden xl:block leading-tight pr-1">
                {showProfileError ? (
                  <>
                    <div className="nav-profile-name font-bold text-destructive -mb-0.5">Unavailable</div>
                    <div className="nav-profile-role text-destructive/80 uppercase tracking-[0.22em] font-semibold text-[10px]">
                      Tap to retry
                    </div>
                  </>
                ) : profileLoading ? (
                  <>
                    <span className="nav-skeleton nav-skeleton-name block -mb-0.5" aria-hidden="true" />
                    <span className="nav-skeleton nav-skeleton-role block" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    <div className="nav-profile-name font-bold text-foreground -mb-0.5">{profile?.username}</div>
                    <div className="nav-profile-role text-primary-glow/90 uppercase tracking-[0.22em] font-semibold">
                      {roleLabel}
                    </div>
                  </>
                )}
              </div>
            </NavLink>

            {/* One-way switch: buyers with a seller account can promote to
                seller mode, but seller mode is locked — they must sign out and
                sign in as a buyer to revert. Prevents accidental auto-switch
                away from seller during a session. */}
            {canSell && effectiveRole === "buyer" && (
              <button
                onClick={() => {
                  setActiveRole("seller");
                  nav("/seller");
                }}
                className="nav-icon-btn hidden md:inline-flex"
                title="Switch to seller mode"
                aria-label="Switch to seller mode"
              >
                <Repeat className="nav-icon" strokeWidth={1.75} />
              </button>
            )}

            <button onClick={async () => { await signOut(); nav("/auth"); }}
              className="nav-icon-btn nav-icon-btn-danger hidden md:inline-flex" aria-label="Sign out">
              <LogOut className="nav-icon" strokeWidth={1.75} />
            </button>

            <button onClick={() => setOpen(!open)} className="nav-icon-btn lg:hidden" aria-label="Menu">
              {open ? <X className="nav-icon" /> : <Menu className="nav-icon" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="nav-drawer lg:hidden border-t border-border/50 bg-background/95 backdrop-blur-2xl">
            {/* Drawer header — avatar + name + balance with skeletons */}
            <div className="nav-drawer-header flex items-center gap-3">
              {profileLoading ? (
                <span className="nav-drawer-avatar nav-skeleton rounded-full" aria-hidden="true" />
              ) : (
                <div className="nav-drawer-avatar rounded-full bg-gradient-primary flex items-center justify-center font-semibold text-primary-foreground shadow-neon">
                  {profile?.username?.[0]?.toUpperCase() ?? "U"}
                </div>
              )}
              <div className="flex-1 min-w-0 leading-tight">
                {profileLoading ? (
                  <>
                    <span className="nav-skeleton nav-drawer-skeleton-name block" aria-hidden="true" />
                    <span className="nav-skeleton nav-drawer-skeleton-role block mt-1.5" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    <div className="nav-drawer-name font-semibold text-foreground truncate">{profile?.username}</div>
                    <div className="nav-drawer-role text-muted-foreground uppercase tracking-[0.22em]">
                      {roleLabel}
                    </div>
                  </>
                )}
              </div>
              <div className="nav-drawer-balance flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary/15 to-gold/10 border border-primary/30 px-3 py-1.5 shrink-0">
                <Wallet className="h-3.5 w-3.5 text-primary-glow shrink-0" strokeWidth={1.75} />
                {profileLoading ? (
                  <span className="nav-skeleton nav-drawer-skeleton-balance" aria-hidden="true" />
                ) : (
                  <span className="font-display font-semibold gold-text text-[13px]">${Number(profile?.balance ?? 0).toFixed(2)}</span>
                )}
              </div>
            </div>

            <div className="nav-drawer-inner grid grid-cols-2">
              {items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.to === "/"} onClick={() => setOpen(false)}
                  className="nav-drawer-item"
                  data-active={isActive(it.to) ? "true" : undefined}>
                  <it.icon className="nav-drawer-icon" strokeWidth={1.75} />
                  <span>{it.label}</span>
                </NavLink>
              ))}
              <button onClick={async () => { await signOut(); nav("/auth"); }}
                className="nav-drawer-item nav-drawer-item-danger col-span-2 justify-center">
                <LogOut className="nav-drawer-icon" strokeWidth={1.75} /> Sign out
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
  const { user, profile, loading, signOut, profileError } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  if (loading && !profileError) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace state={{ from: loc }} />;
  if (profile?.banned) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <div className="glass-neon rounded-2xl p-8 max-w-md">
          <h2 className="font-display text-2xl text-destructive mb-2">ACCOUNT SUSPENDED</h2>
          <p className="text-muted-foreground text-sm mb-6">Your account has been banned. Contact support if you believe this is a mistake.</p>
          <Button onClick={async () => { await signOut(); nav("/auth"); }} variant="outline">Sign out</Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { roles, loading, user, profileError } = useAuth();
  const loc = useLocation();
  const [verifiedAdmin, setVerifiedAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const isPrimaryAdmin = (user?.email ?? "").toLowerCase() === PRIMARY_ADMIN_EMAIL;

  useEffect(() => {
    let active = true;

    if (!user) {
      setVerifiedAdmin(false);
      setCheckingAdmin(false);
      return;
    }

    if (roles.includes("admin")) {
      setVerifiedAdmin(true);
      setCheckingAdmin(false);
      return;
    }

    if (isPrimaryAdmin) {
      setVerifiedAdmin(true);
      setCheckingAdmin(false);
      return;
    }

    setCheckingAdmin(true);
    verifyAdminAccess(user.id, { email: user.email })
      .then((isAdmin) => {
        if (active) {
          setVerifiedAdmin(isAdmin);
        }
      })
      .catch(() => {
        if (active) {
          setVerifiedAdmin(false);
        }
      })
      .finally(() => {
        if (active) {
          setCheckingAdmin(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isPrimaryAdmin, roles, user]);

  // Not signed in → bounce straight to admin login, remembering where they tried to go.
  if (!user) return <Navigate to="/admin-login" replace state={{ from: loc }} />;
  if (isPrimaryAdmin) return <>{children}</>;
  if (loading && !profileError) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (!roles.includes("admin") && checkingAdmin) {
    return <div className="min-h-screen flex items-center justify-center">Checking admin access…</div>;
  }
  // Signed in but not an admin → friendly redirect to /admin-login (not a dead-end page).
  if (!roles.includes("admin") && !verifiedAdmin) {
    return <Navigate to="/admin-login" replace state={{ from: loc, reason: "not-admin" }} />;
  }
  return <>{children}</>;
};
