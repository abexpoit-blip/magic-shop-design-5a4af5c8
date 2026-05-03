import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi, cardsApi, depositsApi, payoutsApi, setToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandLogo, detectBrandFromBin, BRANDS } from "@/lib/brands";
import { parseAndFormat, dedupe, detectBrand } from "@/lib/cardFormatter";
import { toast } from "sonner";
import {
  Check, X, Users, Megaphone, CreditCard, Ban, UserCheck, Wallet,
  TrendingUp, DollarSign, ShoppingCart, Package, FileText, Upload,
  Search, LogIn, Activity, ArrowUpRight, ArrowDownRight, Plus,
  Trash2, Wand2, Newspaper, Send, Eye, UserPlus, BarChart3,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Profile {
  id: string; username: string; email?: string; balance: number;
  is_seller: boolean; banned: boolean; role?: string; created_at?: string;
}
interface Deposit { id: string; user_id: string; amount: number; method: string; proof_url: string | null; status: string; created_at: string; }
interface Payout { id: string; seller_id: string; amount: number; method: string; destination: string; status: string; created_at: string; }
interface DailyRevenue { day: string; revenue: number; orders: number; }
interface TopSeller { id: string; username: string; cards_sold: number; total_sold: number; }
interface RecentOrder { id: string; total: number; status: string; created_at: string; buyer: string; }
interface NewsItem { id: string; title: string; body: string; type: string; created_at: string; }

const Admin = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [userSearch, setUserSearch] = useState("");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annType, setAnnType] = useState("update");

  // Card upload state
  const [cardRaw, setCardRaw] = useState("");
  const [cardPrice, setCardPrice] = useState("1.50");
  const [cardRefundable, setCardRefundable] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);

  // Active tab
  const [tab, setTab] = useState<"overview" | "users" | "cards" | "broadcast">("overview");

  const load = async () => {
    try {
      const [s, u, d, p, n] = await Promise.allSettled([
        adminApi.stats(),
        adminApi.users(userSearch || undefined),
        depositsApi.all(),
        payoutsApi.all(),
        adminApi.getNews(),
      ]);
      if (s.status === "fulfilled") setStats(s.value);
      if (u.status === "fulfilled") setUsers((u.value.users ?? []) as unknown as Profile[]);
      if (d.status === "fulfilled") setDeposits((d.value.deposits ?? []) as unknown as Deposit[]);
      if (p.status === "fulfilled") setPayouts((p.value.payouts ?? []) as unknown as Payout[]);
      if (n.status === "fulfilled") setNews((n.value.news ?? []) as unknown as NewsItem[]);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (userSearch.length === 0 || userSearch.length >= 2) {
      const t = setTimeout(() => { adminApi.users(userSearch || undefined).then(r => setUsers((r.users ?? []) as unknown as Profile[])).catch(() => {}); }, 300);
      return () => clearTimeout(t);
    }
  }, [userSearch]);

  const dailyRevenue = (stats.dailyRevenue ?? []) as DailyRevenue[];
  const topSellers = (stats.topSellers ?? []) as TopSeller[];
  const recentOrders = (stats.recentOrders ?? []) as RecentOrder[];
  const maxRev = Math.max(1, ...dailyRevenue.map(d => d.revenue));

  // Actions
  const decideDeposit = async (dep: Deposit, approve: boolean) => {
    try {
      if (approve) await depositsApi.approve(dep.id);
      else await depositsApi.reject(dep.id);
      toast.success(approve ? "Deposit approved & credited" : "Deposit rejected");
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const decidePayout = async (p: Payout, paid: boolean) => {
    try {
      if (paid) await payoutsApi.complete(p.id);
      else await payoutsApi.reject(p.id);
      toast.success(paid ? "Marked as paid" : "Payout rejected");
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const adjustBalance = async (id: string, delta: number) => {
    const customAmount = prompt(`Enter amount (positive to add, negative to deduct):`);
    if (!customAmount) return;
    const amount = Number(customAmount);
    if (isNaN(amount) || amount === 0) return toast.error("Invalid amount");
    try {
      await adminApi.adjustBalance(id, amount);
      toast.success(`Balance adjusted by $${amount.toFixed(2)}`); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const toggleBan = async (u: Profile) => {
    try {
      await adminApi.toggleBan(u.id);
      toast.success(u.banned ? "User unbanned" : "User banned"); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const revokeSeller = async (u: Profile) => {
    try {
      await adminApi.revokeSeller(u.id);
      toast.success("Seller revoked"); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const makeSeller = async (u: Profile) => {
    try {
      await adminApi.makeSeller(u.id);
      toast.success("Promoted to seller"); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const impersonate = async (u: Profile) => {
    if (!confirm(`Login as ${u.username}? You'll need to log out to return to admin.`)) return;
    try {
      const res = await adminApi.impersonate(u.id);
      setToken(res.token);
      window.location.href = "/";
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  // Card upload
  const publishCards = async () => {
    if (!cardRaw.trim()) return toast.error("Paste cards first");
    setUploadBusy(true);
    try {
      const { lines, failed } = parseAndFormat(cardRaw);
      const { unique, dropped } = dedupe(lines);
      if (unique.length === 0) { toast.error("No valid cards parsed"); setUploadBusy(false); return; }

      const price = Number(cardPrice) || 1.5;
      const rows = unique.map(p => {
        const brand = detectBrand(p.cc);
        const country = p.country !== "null" ? p.country.toUpperCase() : "US";
        return {
          bin: p.cc.slice(0, 6), cc_number: p.cc,
          cvv: p.cvv !== "null" ? p.cvv : null,
          holder_name: p.name !== "null" ? p.name : null,
          address: p.addr !== "null" ? p.addr : null,
          phone: p.tel !== "null" ? p.tel : null,
          email: p.email !== "null" ? p.email : null,
          brand, country,
          state: p.state !== "null" ? p.state : null,
          city: p.city !== "null" ? p.city : null,
          zip: p.zip !== "null" ? p.zip : null,
          exp_month: p.month !== "null" ? p.month : null,
          exp_year: p.year !== "null" ? p.year : null,
          refundable: cardRefundable,
          has_phone: p.tel !== "null",
          has_email: p.email !== "null",
          base: `ADMIN_${new Date().toISOString().slice(0, 10).replace(/-/g, "_")}_${brand}`,
          price,
        };
      });

      const result = await cardsApi.bulkCreate(rows);
      toast.success(`Published ${result.count ?? rows.length} cards` + (dropped > 0 ? ` (${dropped} dupes removed)` : "") + (failed.length > 0 ? ` · ${failed.length} unparseable` : ""));
      setCardRaw(""); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Publish failed"); }
    setUploadBusy(false);
  };

  // Broadcast
  const postNews = async () => {
    if (!annTitle || !annBody) return toast.error("Title and body required");
    try {
      await adminApi.postNews({ title: annTitle, body: annBody, type: annType });
      toast.success("News published"); setAnnTitle(""); setAnnBody(""); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const deleteNews = async (id: string) => {
    try { await adminApi.deleteNews(id); toast.success("Deleted"); load(); } catch { /* ignore */ }
  };

  const pendingDeposits = deposits.filter(d => d.status === "pending");
  const pendingPayouts = payouts.filter(p => p.status === "pending");
  const sellers = users.filter(u => u.is_seller || u.role === "seller");

  return (
    <AdminLayout title="Control Center">
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 flex-wrap">
          {([
            { key: "overview", label: "Overview", icon: BarChart3 },
            { key: "users", label: "Users & Sellers", icon: Users },
            { key: "cards", label: "Card Upload", icon: CreditCard },
            { key: "broadcast", label: "Broadcast", icon: Megaphone },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-gradient-to-r from-primary/20 to-primary/5 text-primary-glow border border-primary/40 shadow-[0_0_16px_-4px_hsl(268_90%_62%/0.3)]"
                  : "bg-secondary/40 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {tab === "overview" && (
          <>
            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard icon={DollarSign} label="Total Revenue" value={`$${Number(stats.totalRevenue ?? 0).toFixed(2)}`} accent="gold" />
              <StatCard icon={TrendingUp} label="Today" value={`$${Number(stats.todayRevenue ?? 0).toFixed(2)}`} accent="success" />
              <StatCard icon={Activity} label="7-Day Revenue" value={`$${Number(stats.weekRevenue ?? 0).toFixed(2)}`} accent="primary" />
              <StatCard icon={Users} label="Total Users" value={String(stats.totalUsers ?? 0)} accent="primary" />
              <StatCard icon={UserCheck} label="Sellers" value={String(stats.totalSellers ?? 0)} accent="primary" />
              <StatCard icon={Package} label="Cards Stock" value={String(stats.cardsAvailable ?? 0)} accent="primary" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={ShoppingCart} label="Cards Sold" value={String(stats.cardsSold ?? 0)} accent="success" />
              <StatCard icon={Wallet} label="Pending Deposits" value={String(stats.pendingDeposits ?? 0)} accent={Number(stats.pendingDeposits) > 0 ? "warning" : "primary"} />
              <StatCard icon={CreditCard} label="Pending Payouts" value={String(stats.pendingPayouts ?? 0)} accent={Number(stats.pendingPayouts) > 0 ? "warning" : "primary"} />
              <StatCard icon={FileText} label="Open Tickets" value={String(stats.openTickets ?? 0)} accent={Number(stats.openTickets) > 0 ? "warning" : "primary"} />
            </div>

            {/* Revenue Chart */}
            <Section icon={BarChart3} title="REVENUE · LAST 30 DAYS">
              {dailyRevenue.length > 0 ? (
                <div className="flex items-end gap-1 h-48">
                  {dailyRevenue.map(d => (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                      <span className="text-[9px] font-mono text-primary-glow opacity-0 group-hover:opacity-100 transition">${Number(d.revenue).toFixed(0)}</span>
                      <div className="w-full rounded-t bg-gradient-to-t from-primary/40 to-primary-glow/80 transition-all hover:from-primary/60 hover:to-primary-glow"
                        style={{ height: `${Math.max(4, (d.revenue / maxRev) * 100)}%` }}
                        title={`${d.day}: $${Number(d.revenue).toFixed(2)} (${d.orders} orders)`} />
                      <span className="text-[8px] text-muted-foreground font-mono hidden lg:block">{d.day.slice(5)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No sales data yet.</p>
              )}
            </Section>

            {/* Pending Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section icon={Wallet} title={`PENDING DEPOSITS (${pendingDeposits.length})`}>
                {pendingDeposits.length === 0 && <p className="text-sm text-muted-foreground">No pending deposits.</p>}
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {pendingDeposits.map(d => {
                    const u = users.find(x => x.id === d.user_id);
                    return (
                      <div key={d.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/40 border border-border/40 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-sm">${Number(d.amount).toFixed(2)} · <span className="text-primary-glow">{d.method}</span>
                            <span className="text-xs text-muted-foreground"> · {u?.username ?? "?"}</span></p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{d.proof_url}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => decideDeposit(d, true)} className="bg-success/90 text-white h-8"><Check className="h-3 w-3 mr-1" />Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => decideDeposit(d, false)} className="h-8"><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section icon={CreditCard} title={`PAYOUT REQUESTS (${pendingPayouts.length})`}>
                {pendingPayouts.length === 0 && <p className="text-sm text-muted-foreground">No pending payouts.</p>}
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {pendingPayouts.map(p => {
                    const u = users.find(x => x.id === p.seller_id);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/40 border border-border/40 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-sm">${Number(p.amount).toFixed(2)} · <span className="text-primary-glow">{p.method}</span>
                            <span className="text-xs text-muted-foreground"> · {u?.username ?? "?"}</span></p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{p.destination}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => decidePayout(p, true)} className="bg-success/90 text-white h-8"><Check className="h-3 w-3 mr-1" />Paid</Button>
                          <Button size="sm" variant="destructive" onClick={() => decidePayout(p, false)} className="h-8"><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>

            {/* Recent Orders & Top Sellers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section icon={ShoppingCart} title="RECENT ORDERS">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr><th className="p-2 text-left">Buyer</th><th className="p-2 text-right">Total</th><th className="p-2">Status</th><th className="p-2 text-right">Date</th></tr>
                    </thead>
                    <tbody>
                      {recentOrders.map(o => (
                        <tr key={o.id} className="border-t border-border/40">
                          <td className="p-2 text-foreground">{o.buyer}</td>
                          <td className="p-2 text-right font-display text-primary-glow">${Number(o.total).toFixed(2)}</td>
                          <td className="p-2 text-center">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                              o.status === "completed" ? "bg-success/20 text-success border-success/40" : "bg-warning/20 text-warning border-warning/40"
                            }`}>{o.status}</span>
                          </td>
                          <td className="p-2 text-right text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {recentOrders.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-xs">No orders yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section icon={TrendingUp} title="TOP SELLERS">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr><th className="p-2 text-left">Seller</th><th className="p-2 text-right">Sold</th><th className="p-2 text-right">Revenue</th></tr>
                    </thead>
                    <tbody>
                      {topSellers.map((s, i) => (
                        <tr key={s.id} className="border-t border-border/40">
                          <td className="p-2">
                            <span className={`inline-flex items-center gap-2 ${i < 3 ? "text-gold" : "text-foreground"}`}>
                              <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                              {s.username}
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono">{s.cards_sold}</td>
                          <td className="p-2 text-right font-display text-primary-glow">${Number(s.total_sold).toFixed(2)}</td>
                        </tr>
                      ))}
                      {topSellers.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground text-xs">No sellers yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>

            {/* Financial Summary */}
            <Section icon={DollarSign} title="FINANCIAL SUMMARY">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mini label="Total Deposits (Approved)" value={`$${Number(stats.totalDeposits ?? 0).toFixed(2)}`} highlight />
                <Mini label="Total Payouts (Paid)" value={`$${Number(stats.totalPayoutsPaid ?? 0).toFixed(2)}`} />
                <Mini label="30-Day Revenue" value={`$${Number(stats.monthRevenue ?? 0).toFixed(2)}`} highlight />
                <Mini label="Pending Applications" value={String(stats.pendingApps ?? 0)} />
              </div>
            </Section>
          </>
        )}

        {/* ═══ USERS TAB ═══ */}
        {tab === "users" && (
          <>
            <Section icon={Users} title={`ALL USERS (${users.length})`}>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search username or email…" className="bg-input/60 pl-9" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
                    <tr>
                      <th className="p-2.5 text-left">Username</th>
                      <th className="p-2.5 text-left">Email</th>
                      <th className="p-2.5 text-right">Balance</th>
                      <th className="p-2.5 text-center">Role</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center">Joined</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className={`border-t border-border/40 hover:bg-secondary/20 ${u.banned ? "opacity-50" : ""}`}>
                        <td className="p-2.5 font-medium">{u.username}</td>
                        <td className="p-2.5 text-xs text-muted-foreground">{u.email ?? "—"}</td>
                        <td className="p-2.5 text-right font-display text-primary-glow">${Number(u.balance ?? 0).toFixed(2)}</td>
                        <td className="p-2.5 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            u.role === "admin" ? "bg-primary/20 text-primary-glow border-primary/40" :
                            u.role === "seller" || u.is_seller ? "bg-gold/20 text-gold border-gold/40" :
                            "bg-secondary text-muted-foreground border-border"
                          }`}>{u.role || (u.is_seller ? "seller" : "buyer")}</span>
                        </td>
                        <td className="p-2.5 text-center">
                          {u.banned
                            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive border border-destructive/40">Banned</span>
                            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/20 text-success border border-success/40">Active</span>}
                        </td>
                        <td className="p-2.5 text-center text-xs text-muted-foreground">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => adjustBalance(u.id, 0)} title="Adjust balance" className="h-7 w-7 p-0">
                              <DollarSign className="h-3 w-3" />
                            </Button>
                            {(u.role !== "seller" && !u.is_seller) && (
                              <Button size="sm" variant="outline" onClick={() => makeSeller(u)} title="Promote to seller" className="h-7 w-7 p-0">
                                <UserPlus className="h-3 w-3" />
                              </Button>
                            )}
                            {(u.role === "seller" || u.is_seller) && (
                              <Button size="sm" variant="outline" onClick={() => revokeSeller(u)} title="Revoke seller" className="h-7 w-7 p-0">
                                <UserCheck className="h-3 w-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => impersonate(u)} title="Login as user" className="h-7 w-7 p-0 text-primary-glow">
                              <LogIn className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant={u.banned ? "outline" : "destructive"} onClick={() => toggleBan(u)} title={u.banned ? "Unban" : "Ban"} className="h-7 w-7 p-0">
                              <Ban className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Seller Summary */}
            <Section icon={TrendingUp} title={`SELLERS (${sellers.length})`}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sellers.map(s => (
                  <div key={s.id} className="p-4 rounded-xl bg-secondary/30 border border-border/40 hover:border-primary/40 transition">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display text-sm text-foreground">{s.username}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        s.banned ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"
                      }`}>{s.banned ? "Banned" : "Active"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Balance: <span className="text-primary-glow font-display">${Number(s.balance ?? 0).toFixed(2)}</span></p>
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="outline" onClick={() => impersonate(s)} className="h-7 text-[10px]"><LogIn className="h-3 w-3 mr-1" />Login as</Button>
                      <Button size="sm" variant="outline" onClick={() => adjustBalance(s.id, 0)} className="h-7 text-[10px]"><DollarSign className="h-3 w-3 mr-1" />Balance</Button>
                    </div>
                  </div>
                ))}
                {sellers.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-6">No sellers yet.</p>}
              </div>
            </Section>
          </>
        )}

        {/* ═══ CARD UPLOAD TAB ═══ */}
        {tab === "cards" && (
          <>
            <Section icon={Upload} title="ADMIN CARD UPLOAD">
              <p className="text-xs text-muted-foreground mb-3">
                Paste cards in any format — auto-detects fields, dedupes, and detects brand from BIN.
                Format: <code className="text-primary-glow">cc|month|year|cvv|name|addr|city|state|zip|country|tel|email</code>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Default Price ($)</label>
                  <Input type="number" step="0.01" value={cardPrice} onChange={e => setCardPrice(e.target.value)} className="bg-input/60 mt-1" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Refundable</label>
                  <Select value={cardRefundable ? "yes" : "no"} onValueChange={v => setCardRefundable(v === "yes")}>
                    <SelectTrigger className="bg-input/60 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Non-refundable</SelectItem>
                      <SelectItem value="yes">Refundable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="cursor-pointer">
                  <input type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) file.text().then(t => setCardRaw(t));
                  }} />
                  <div className="flex items-center justify-center h-10 mt-5 px-4 rounded-md border-2 border-dashed border-primary/40 hover:border-primary text-sm text-primary-glow hover:bg-primary/5 transition">
                    <FileText className="h-4 w-4 mr-2" />Drop .txt / .csv file
                  </div>
                </label>
              </div>
              <Textarea rows={10} value={cardRaw} onChange={e => setCardRaw(e.target.value)}
                placeholder="4111111111111111|12|28|123|John Smith|123 Main St|New York|NY|10001|US|+15555551234|john@x.com"
                className="bg-input/60 font-mono text-xs mb-3" />
              <div className="flex items-center gap-3">
                <Button onClick={publishCards} disabled={uploadBusy} className="bg-gradient-primary shadow-neon">
                  <Upload className="h-4 w-4 mr-2" />{uploadBusy ? "Publishing…" : "Publish Cards"}
                </Button>
                <Button onClick={() => {
                  const { lines, failed } = parseAndFormat(cardRaw);
                  const { unique, dropped } = dedupe(lines);
                  toast.success(`Preview: ${unique.length} valid, ${dropped} dupes, ${failed.length} failed`);
                }} variant="outline" className="border-primary/40 text-primary-glow">
                  <Wand2 className="h-4 w-4 mr-2" />Preview & Validate
                </Button>
              </div>
            </Section>
          </>
        )}

        {/* ═══ BROADCAST TAB ═══ */}
        {tab === "broadcast" && (
          <>
            <Section icon={Newspaper} title="PUBLISH NEWS / BROADCAST">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                <div className="md:col-span-2">
                  <Input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Title" className="bg-input/60" />
                </div>
                <Select value={annType} onValueChange={setAnnType}>
                  <SelectTrigger className="bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="alert">Alert</SelectItem>
                    <SelectItem value="promo">Promotion</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={postNews} className="bg-gradient-primary shadow-neon"><Send className="h-4 w-4 mr-2" />Publish</Button>
              </div>
              <Textarea value={annBody} onChange={e => setAnnBody(e.target.value)} placeholder="Write your broadcast message…" rows={4} className="bg-input/60" />
            </Section>

            <Section icon={Megaphone} title={`NEWS HISTORY (${news.length})`}>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {news.map(n => (
                  <div key={n.id} className="p-4 rounded-lg bg-secondary/40 border border-border/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            n.type === "alert" ? "bg-destructive/20 text-destructive border-destructive/40" :
                            n.type === "promo" ? "bg-gold/20 text-gold border-gold/40" :
                            n.type === "maintenance" ? "bg-warning/20 text-warning border-warning/40" :
                            "bg-primary/20 text-primary-glow border-primary/40"
                          }`}>{n.type}</span>
                          <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                        </div>
                        <h3 className="font-display text-sm text-foreground">{n.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{n.body}</p>
                      </div>
                      <button onClick={() => deleteNews(n.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {news.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No broadcasts yet.</p>}
              </div>
            </Section>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

const Section = ({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) => (
  <section className="glass rounded-2xl p-6">
    <div className="flex items-center gap-2 mb-4"><Icon className="h-4 w-4 text-primary-glow" /><h2 className="font-display tracking-wider text-primary-glow text-sm">{title}</h2></div>
    {children}
  </section>
);

const StatCard = ({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent: "gold" | "primary" | "success" | "warning" }) => {
  const color = accent === "gold" ? "text-gold" : accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-primary-glow";
  return (
    <div className="glass rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-tight">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      <p className={`font-display text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
};

const Mini = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`p-3 rounded-lg border ${highlight ? "bg-primary/10 border-primary/40" : "bg-secondary/30 border-border/40"}`}>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={`font-display text-lg font-bold mt-1 ${highlight ? "neon-text" : "text-foreground"}`}>{value}</p>
  </div>
);

export default Admin;
