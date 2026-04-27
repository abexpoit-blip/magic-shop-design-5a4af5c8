import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Check, X, Shield, Users, Megaphone, Ticket, DollarSign, ShoppingBag, TrendingUp,
  CreditCard, Ban, UserCheck, Wallet, Upload, Trash2,
} from "lucide-react";
import { BRANDS, COUNTRIES } from "@/lib/brands";

interface Application { id: string; user_id: string; shop_name: string | null; contact: string | null; description: string | null; status: string; telegram?: string | null; jabber?: string | null; expected_volume?: string | null; sample_bins?: string | null; message?: string | null; admin_note?: string | null; created_at: string; }
interface Profile { id: string; username: string; balance: number; is_seller: boolean; banned: boolean; is_seller_verified?: boolean; is_seller_visible?: boolean; commission_percent?: number; seller_display_name?: string | null; }
interface RefundRequest { id: string; buyer_id: string; seller_id: string; card_id: string | null; kind: string; reason: string | null; status: string; created_at: string; }
interface TicketRow { id: string; user_id: string; subject: string; message: string; reply: string | null; status: string; }
interface Order { id: string; user_id: string; total: number; status: string; created_at: string; }
interface Deposit { id: string; user_id: string; amount: number; method: string; txid: string | null; status: string; created_at: string; }
interface Payout { id: string; seller_id: string; amount: number; method: string; address: string; status: string; created_at: string; }
interface Card { id: string; seller_id: string; bin: string; brand: string; country: string; price: number; status: string; created_at: string; }
interface DepositAddress { id: string; method: string; address: string; network: string | null; }

const Admin = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [addresses, setAddresses] = useState<DepositAddress[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [bulk, setBulk] = useState("");

  const load = async () => {
    const [a, u, t, o, d, p, c, da, rf] = await Promise.all([
      supabase.from("seller_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,username,balance,is_seller,banned,is_seller_verified,is_seller_visible,commission_percent,seller_display_name").order("created_at", { ascending: false }).limit(100),
      supabase.from("tickets").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("deposits").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("payouts").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("cards").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("deposit_addresses").select("*"),
      (supabase.from("refund_requests" as never) as any).select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setApps(((a as any).data ?? []) as Application[]);
    setUsers(((u as any).data ?? []) as Profile[]);
    setTickets((t.data ?? []) as TicketRow[]);
    setOrders((o.data ?? []) as Order[]);
    setDeposits((d.data ?? []) as Deposit[]);
    setPayouts((p.data ?? []) as Payout[]);
    setCards((c.data ?? []) as Card[]);
    setAddresses((da.data ?? []) as DepositAddress[]);
    setRefunds(((rf as any).data ?? []) as RefundRequest[]);
  };
  useEffect(() => { load(); }, []);

  // ============= STATS =============
  const stats = useMemo(() => {
    const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const today = new Date().toISOString().slice(0, 10);
    const todayRevenue = orders.filter((o) => o.created_at.slice(0, 10) === today).reduce((s, o) => s + Number(o.total), 0);
    const pendingDeposits = deposits.filter((d) => d.status === "pending").length;
    const pendingPayouts = payouts.filter((p) => p.status === "pending").length;
    const cardsAvailable = cards.filter((c) => c.status === "available").length;
    const cardsSold = cards.filter((c) => c.status === "sold").length;
    const days = Array.from({ length: 14 }).map((_, i) => {
      const dt = new Date(); dt.setDate(dt.getDate() - (13 - i));
      const key = dt.toISOString().slice(0, 10);
      const total = orders.filter((o) => o.created_at.slice(0, 10) === key).reduce((s, o) => s + Number(o.total), 0);
      return { key, total };
    });
    const max = Math.max(1, ...days.map((d) => d.total));
    return { totalRevenue, todayRevenue, pendingDeposits, pendingPayouts, cardsAvailable, cardsSold, totalUsers: users.length, totalOrders: orders.length, days, max };
  }, [orders, deposits, payouts, cards, users]);

  // ============= ACTIONS =============
  const decideApp = async (app: Application, approve: boolean, note?: string) => {
    await (supabase.from("seller_applications") as any).update({
      status: approve ? "approved" : "rejected",
      admin_note: note ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", app.id);
    if (approve) {
      await supabase.from("user_roles").insert({ user_id: app.user_id, role: "seller" });
      await (supabase.from("profiles") as any).update({ is_seller: true, seller_status: "approved" }).eq("id", app.user_id);
    }
    toast.success(approve ? "Seller approved" : "Application rejected"); load();
  };

  const updateSellerProfile = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await (supabase.from("profiles") as any).update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Seller updated"); load();
  };

  const decideRefund = async (r: RefundRequest, approve: boolean) => {
    await (supabase.from("refund_requests" as never) as any)
      .update({ status: approve ? "approved" : "rejected", resolved_at: new Date().toISOString() })
      .eq("id", r.id);
    if (approve) {
      // refund buyer balance for the card price
      const card = cards.find((c) => c.id === r.card_id);
      const buyer = users.find((u) => u.id === r.buyer_id);
      if (card && buyer) {
        await supabase.from("profiles").update({ balance: Number(buyer.balance) + Number(card.price) }).eq("id", buyer.id);
        await supabase.from("transactions").insert({ user_id: buyer.id, amount: Number(card.price), kind: "refund", method: "admin", note: `Refund for card ${card.bin}` });
      }
    }
    toast.success(approve ? "Refund approved & credited" : "Refund rejected"); load();
  };

  const adjustBalance = async (id: string, delta: number) => {
    const u = users.find((x) => x.id === id); if (!u) return;
    await supabase.from("profiles").update({ balance: Number(u.balance) + delta }).eq("id", id);
    await supabase.from("transactions").insert({ user_id: id, amount: delta, kind: delta > 0 ? "admin_credit" : "admin_debit", method: "manual" });
    toast.success("Balance updated"); load();
  };

  const toggleBan = async (u: Profile) => {
    await supabase.from("profiles").update({ banned: !u.banned }).eq("id", u.id);
    toast.success(u.banned ? "User unbanned" : "User banned"); load();
  };

  const revokeSeller = async (u: Profile) => {
    await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "seller");
    await supabase.from("profiles").update({ is_seller: false, seller_status: "revoked" }).eq("id", u.id);
    toast.success("Seller revoked"); load();
  };

  const replyTicket = async (id: string, reply: string) => {
    await supabase.from("tickets").update({ reply, status: "closed" }).eq("id", id);
    toast.success("Reply sent"); load();
  };

  const postAnnouncement = async () => {
    if (!annTitle || !annBody) return;
    await supabase.from("announcements").insert({ title: annTitle, body: annBody });
    toast.success("Announcement posted"); setAnnTitle(""); setAnnBody("");
  };

  const decideDeposit = async (dep: Deposit, approve: boolean) => {
    if (approve) {
      const u = users.find((x) => x.id === dep.user_id);
      const amt = Number(dep.amount);
      let bonus = 0;
      if (amt >= 5000) bonus = 750;
      else if (amt >= 2000) bonus = 240;
      else if (amt >= 1000) bonus = 100;
      else if (amt >= 500) bonus = 35;
      const total = amt + bonus;
      if (u) await supabase.from("profiles").update({ balance: Number(u.balance) + total }).eq("id", u.id);
      await supabase.from("transactions").insert({ user_id: dep.user_id, amount: total, kind: "recharge", method: dep.method, note: bonus ? `Includes $${bonus} bonus` : null });
    }
    await supabase.from("deposits").update({ status: approve ? "approved" : "rejected", reviewed_at: new Date().toISOString() }).eq("id", dep.id);
    toast.success(approve ? "Deposit approved & credited" : "Deposit rejected"); load();
  };

  const decidePayout = async (p: Payout, paid: boolean) => {
    await supabase.from("payouts").update({ status: paid ? "paid" : "rejected", paid_at: paid ? new Date().toISOString() : null }).eq("id", p.id);
    toast.success(paid ? "Marked as paid" : "Payout rejected"); load();
  };

  const updateAddress = async (a: DepositAddress, field: "address" | "network", value: string) => {
    const patch = field === "address"
      ? { address: value, updated_at: new Date().toISOString() }
      : { network: value, updated_at: new Date().toISOString() };
    await supabase.from("deposit_addresses").update(patch).eq("id", a.id);
    load();
  };

  const adminBulkUpload = async () => {
    if (!bulk) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const lines = bulk.trim().split("\n").filter(Boolean);
    const rows = lines.map((line) => {
      const [bin, brand, country, state, city, zip, exp_month, exp_year, price] = line.split(",").map((s) => s.trim());
      return {
        seller_id: user.id, bin, brand: (brand || "VISA").toUpperCase(), country: (country || "US").toUpperCase(),
        state, city, zip, exp_month, exp_year, price: Number(price || 1.5),
        base: `${new Date().toISOString().slice(0,10)}_${country}_${brand}_$${price}_ADMIN`,
        refundable: false, has_phone: true, has_email: true,
      };
    });
    const { error } = await supabase.from("cards").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Admin uploaded ${rows.length} cards`); setBulk(""); load();
  };

  const removeCard = async (id: string) => {
    await supabase.from("cards").delete().eq("id", id);
    load();
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary-glow" />
          <h1 className="font-display text-3xl font-black neon-text">ADMIN CONTROL CENTER</h1>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={DollarSign} label="Total revenue" value={`$${stats.totalRevenue.toFixed(2)}`} accent="gold" />
          <Stat icon={TrendingUp} label="Today" value={`$${stats.todayRevenue.toFixed(2)}`} accent="success" />
          <Stat icon={ShoppingBag} label="Orders" value={String(stats.totalOrders)} accent="primary" />
          <Stat icon={Users} label="Users" value={String(stats.totalUsers)} accent="primary" />
          <Stat icon={Wallet} label="Pending deposits" value={String(stats.pendingDeposits)} accent={stats.pendingDeposits > 0 ? "warning" : "primary"} />
          <Stat icon={CreditCard} label="Pending payouts" value={String(stats.pendingPayouts)} accent={stats.pendingPayouts > 0 ? "warning" : "primary"} />
          <Stat icon={CreditCard} label="Cards available" value={String(stats.cardsAvailable)} accent="primary" />
          <Stat icon={Check} label="Cards sold" value={String(stats.cardsSold)} accent="success" />
        </div>

        {/* SALES CHART */}
        <Section icon={TrendingUp} title="SALES · LAST 14 DAYS">
          <div className="flex items-end gap-2 h-40">
            {stats.days.map((d) => (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t bg-gradient-to-t from-gold/40 to-gold/90"
                  style={{ height: `${(d.total / stats.max) * 100}%`, minHeight: d.total ? 4 : 2 }}
                  title={`$${d.total.toFixed(2)}`} />
                <span className="text-[9px] text-muted-foreground font-mono">{d.key.slice(5)}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* DEPOSITS */}
        <Section icon={Wallet} title={`PENDING DEPOSITS (${stats.pendingDeposits})`}>
          <div className="space-y-2">
            {deposits.filter((d) => d.status === "pending").length === 0 && <p className="text-sm text-muted-foreground">No pending deposits.</p>}
            {deposits.filter((d) => d.status === "pending").map((d) => {
              const u = users.find((x) => x.id === d.user_id);
              return (
                <div key={d.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/40 border border-border/40 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-display">${Number(d.amount).toFixed(2)} · <span className="text-primary-glow">{d.method}</span> <span className="text-xs text-muted-foreground">· {u?.username ?? d.user_id.slice(0, 8)}</span></p>
                    <p className="text-[10px] font-mono text-muted-foreground truncate">{d.txid}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decideDeposit(d, true)} className="bg-success text-white"><Check className="h-3 w-3 mr-1" />Approve & credit</Button>
                    <Button size="sm" variant="destructive" onClick={() => decideDeposit(d, false)}><X className="h-3 w-3" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* PAYOUTS */}
        <Section icon={CreditCard} title={`PAYOUT REQUESTS (${stats.pendingPayouts})`}>
          <div className="space-y-2">
            {payouts.filter((p) => p.status === "pending").length === 0 && <p className="text-sm text-muted-foreground">No pending payouts.</p>}
            {payouts.filter((p) => p.status === "pending").map((p) => {
              const u = users.find((x) => x.id === p.seller_id);
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/40 border border-border/40 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-display">${Number(p.amount).toFixed(2)} · <span className="text-primary-glow">{p.method}</span> <span className="text-xs text-muted-foreground">· {u?.username ?? p.seller_id.slice(0, 8)}</span></p>
                    <p className="text-[10px] font-mono text-muted-foreground truncate">{p.address}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decidePayout(p, true)} className="bg-success text-white"><Check className="h-3 w-3 mr-1" />Mark paid</Button>
                    <Button size="sm" variant="destructive" onClick={() => decidePayout(p, false)}><X className="h-3 w-3" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* DEPOSIT ADDRESSES */}
        <Section icon={Wallet} title="DEPOSIT ADDRESSES (USER-FACING)">
          <div className="space-y-2">
            {addresses.map((a) => (
              <div key={a.id} className="grid grid-cols-1 md:grid-cols-[80px_120px_1fr] gap-2 items-center p-3 rounded-lg bg-secondary/40 border border-border/40">
                <span className="font-display text-primary-glow">{a.method}</span>
                <Input defaultValue={a.network ?? ""} onBlur={(e) => updateAddress(a, "network", e.target.value)} placeholder="Network" className="bg-input/60" />
                <Input defaultValue={a.address} onBlur={(e) => updateAddress(a, "address", e.target.value)} className="bg-input/60 font-mono text-xs" />
              </div>
            ))}
          </div>
        </Section>

        {/* APPLICATIONS */}
        <Section icon={Users} title="SELLER APPLICATIONS">
          {apps.length === 0 && <p className="text-sm text-muted-foreground">No applications.</p>}
          <div className="space-y-2">
            {apps.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/40 flex-wrap gap-2">
                <div>
                  <p className="font-medium">{a.shop_name} <span className="text-xs text-muted-foreground">· {a.contact}</span></p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                  <p className="text-[10px] mt-1">status: <span className={a.status === "pending" ? "text-warning" : "text-muted-foreground"}>{a.status}</span></p>
                </div>
                {a.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decideApp(a, true)} className="bg-success text-white"><Check className="h-3 w-3 mr-1" />Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => decideApp(a, false)}><X className="h-3 w-3 mr-1" />Reject</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* ADMIN UPLOAD CARDS */}
        <Section icon={Upload} title="ADMIN: BULK UPLOAD CARDS">
          <p className="text-xs text-muted-foreground mb-2">Cards uploaded as admin attach to your account. CSV: <code className="text-primary-glow">bin,brand,country,state,city,zip,exp_month,exp_year,price</code></p>
          <Textarea rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="411111,VISA,US,NY,New York,10001,12,28,1.5" className="bg-input/60 font-mono text-xs" />
          <Button onClick={adminBulkUpload} className="mt-3 bg-gradient-primary shadow-neon">Upload as admin</Button>
        </Section>

        {/* ALL CARDS MODERATION */}
        <Section icon={CreditCard} title={`ALL CARDS (${cards.length})`}>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground sticky top-0 bg-background/95">
                <tr><th className="p-2 text-left">Brand</th><th className="p-2 text-left">BIN</th><th className="p-2 text-left">Country</th><th className="p-2 text-right">Price</th><th className="p-2">Status</th><th className="p-2 text-left">Seller</th><th></th></tr>
              </thead>
              <tbody>
                {cards.slice(0, 100).map((c) => {
                  const u = users.find((x) => x.id === c.seller_id);
                  return (
                    <tr key={c.id} className="border-t border-border/40">
                      <td className="p-2">{c.brand}</td>
                      <td className="p-2 font-mono">{c.bin}</td>
                      <td className="p-2">{c.country}</td>
                      <td className="p-2 text-right text-primary-glow font-display">${Number(c.price).toFixed(2)}</td>
                      <td className="p-2 text-center"><span className="text-xs">{c.status}</span></td>
                      <td className="p-2 text-xs text-muted-foreground">{u?.username ?? c.seller_id.slice(0, 8)}</td>
                      <td className="p-2 text-right"><button onClick={() => removeCard(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* USERS */}
        <Section icon={Users} title="USERS">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th className="p-2 text-left">Username</th><th className="p-2 text-left">Balance</th><th className="p-2">Seller</th><th className="p-2">Banned</th><th className="p-2 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={`border-t border-border/40 ${u.banned ? "opacity-60" : ""}`}>
                    <td className="p-2">{u.username}</td>
                    <td className="p-2 text-primary-glow font-display">${Number(u.balance).toFixed(2)}</td>
                    <td className="p-2 text-center">{u.is_seller ? "✓" : "—"}</td>
                    <td className="p-2 text-center">{u.banned ? <span className="text-destructive">✗</span> : "—"}</td>
                    <td className="p-2 text-right space-x-1 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => adjustBalance(u.id, 50)}>+$50</Button>
                      <Button size="sm" variant="outline" onClick={() => adjustBalance(u.id, -50)}>−$50</Button>
                      {u.is_seller && <Button size="sm" variant="outline" onClick={() => revokeSeller(u)} title="Revoke seller"><UserCheck className="h-3 w-3" /></Button>}
                      <Button size="sm" variant={u.banned ? "outline" : "destructive"} onClick={() => toggleBan(u)} title={u.banned ? "Unban" : "Ban"}><Ban className="h-3 w-3" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* TICKETS */}
        <Section icon={Ticket} title="TICKETS">
          <div className="space-y-3">
            {tickets.map((t) => (
              <TicketAdminRow key={t.id} ticket={t} onReply={replyTicket} />
            ))}
            {tickets.length === 0 && <p className="text-sm text-muted-foreground">No tickets.</p>}
          </div>
        </Section>

        {/* ANNOUNCEMENT */}
        <Section icon={Megaphone} title="POST ANNOUNCEMENT">
          <Input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Title" className="bg-input/60 mb-2" />
          <Textarea value={annBody} onChange={(e) => setAnnBody(e.target.value)} placeholder="Body" rows={3} className="bg-input/60" />
          <Button onClick={postAnnouncement} className="mt-3 bg-gradient-primary shadow-neon">Post</Button>
        </Section>
      </div>
    </AppShell>
  );
};

const Section = ({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) => (
  <section className="glass rounded-2xl p-6">
    <div className="flex items-center gap-2 mb-4"><Icon className="h-4 w-4 text-primary-glow" /><h2 className="font-display tracking-wider text-primary-glow">{title}</h2></div>
    {children}
  </section>
);

const Stat = ({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent: "gold" | "primary" | "success" | "warning" }) => {
  const color = accent === "gold" ? "text-gold gold-text" : accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-primary-glow neon-text";
  const iconColor = accent === "gold" ? "text-gold" : accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-primary-glow";
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <p className={`mt-2 font-display text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
};

const TicketAdminRow = ({ ticket, onReply }: { ticket: TicketRow; onReply: (id: string, reply: string) => void }) => {
  const [reply, setReply] = useState(ticket.reply ?? "");
  return (
    <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
      <div className="flex justify-between mb-2">
        <p className="font-medium">{ticket.subject}</p>
        <span className={`text-xs ${ticket.status === "open" ? "text-warning" : "text-success"}`}>{ticket.status}</span>
      </div>
      <p className="text-sm text-foreground/80 mb-2">{ticket.message}</p>
      <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" rows={2} className="bg-input/60 mb-2" />
      <Button size="sm" onClick={() => onReply(ticket.id, reply)} className="bg-gradient-primary">Send reply</Button>
    </div>
  );
};

export default Admin;
