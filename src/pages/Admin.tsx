import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi, cardsApi, announcementsApi, ticketsApi, depositsApi, payoutsApi, sellerAppsApi, refundsApi, depositAddressesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Check, X, Shield, Users, Megaphone, Ticket, DollarSign, ShoppingBag, TrendingUp,
  CreditCard, Ban, UserCheck, Wallet, Upload, Trash2, Eye, EyeOff, BadgeCheck, Search, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface Profile { id: string; username: string; balance: number; is_seller: boolean; banned: boolean; is_seller_verified?: boolean; is_seller_visible?: boolean; commission_percent?: number; seller_display_name?: string | null; }
interface TicketRow { id: string; user_id: string; subject: string; message: string; reply: string | null; status: string; }
interface Order { id: string; user_id: string; total: number; status: string; created_at: string; }
interface Deposit { id: string; user_id: string; amount: number; method: string; txid: string | null; status: string; created_at: string; }
interface Payout { id: string; seller_id: string; amount: number; method: string; address: string; status: string; created_at: string; }
interface Card { id: string; seller_id: string; bin: string; brand: string; country: string; price: number; status: string; created_at: string; }

const Admin = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");

  const load = async () => {
    try {
      const [u, t, o, d, p, c] = await Promise.allSettled([
        adminApi.users(),
        ticketsApi.all(),
        adminApi.stats(),
        depositsApi.all(),
        payoutsApi.all(),
        cardsApi.browse({ limit: 200 }),
      ]);
      if (u.status === "fulfilled") setUsers((u.value.users ?? []) as unknown as Profile[]);
      if (t.status === "fulfilled") setTickets((t.value.tickets ?? []) as unknown as TicketRow[]);
      if (d.status === "fulfilled") setDeposits((d.value.deposits ?? []) as unknown as Deposit[]);
      if (p.status === "fulfilled") setPayouts((p.value.payouts ?? []) as unknown as Payout[]);
      if (c.status === "fulfilled") setCards((c.value.cards ?? []) as unknown as Card[]);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const pendingDeposits = deposits.filter((d) => d.status === "pending").length;
    const pendingPayouts = payouts.filter((p) => p.status === "pending").length;
    const cardsAvailable = cards.filter((c) => c.status === "available").length;
    const cardsSold = cards.filter((c) => c.status === "sold").length;
    return { pendingDeposits, pendingPayouts, cardsAvailable, cardsSold, totalUsers: users.length };
  }, [deposits, payouts, cards, users]);

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
    try {
      await adminApi.adjustBalance(id, delta);
      toast.success("Balance updated"); load();
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

  const replyTicket = async (id: string, reply: string) => {
    try {
      await ticketsApi.reply(id, reply);
      toast.success("Reply sent"); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const postAnnouncement = async () => {
    if (!annTitle || !annBody) return;
    try {
      await announcementsApi.create({ title: annTitle, body: annBody });
      toast.success("Announcement posted"); setAnnTitle(""); setAnnBody("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <AdminLayout title="Control Center">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={Users} label="Users" value={String(stats.totalUsers)} accent="primary" />
          <Stat icon={Wallet} label="Pending deposits" value={String(stats.pendingDeposits)} accent={stats.pendingDeposits > 0 ? "warning" : "primary"} />
          <Stat icon={CreditCard} label="Pending payouts" value={String(stats.pendingPayouts)} accent={stats.pendingPayouts > 0 ? "warning" : "primary"} />
          <Stat icon={CreditCard} label="Cards available" value={String(stats.cardsAvailable)} accent="primary" />
        </div>

        {/* DEPOSITS */}
        <Section icon={Wallet} title={`PENDING DEPOSITS (${stats.pendingDeposits})`}>
          <div className="space-y-2">
            {deposits.filter((d) => d.status === "pending").length === 0 && <p className="text-sm text-muted-foreground">No pending deposits.</p>}
            {deposits.filter((d) => d.status === "pending").map((d) => {
              const u = users.find((x) => x.id === d.user_id);
              return (
                <div key={d.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/40 border border-border/40 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-display">${Number(d.amount).toFixed(2)} · <span className="text-primary-glow">{d.method}</span> <span className="text-xs text-muted-foreground">· {u?.username ?? d.user_id?.slice(0, 8)}</span></p>
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
                    <p className="font-display">${Number(p.amount).toFixed(2)} · <span className="text-primary-glow">{p.method}</span> <span className="text-xs text-muted-foreground">· {u?.username ?? p.seller_id?.slice(0, 8)}</span></p>
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
    </AdminLayout>
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
