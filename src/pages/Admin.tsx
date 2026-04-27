import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, X, Shield, Users, Megaphone, Ticket } from "lucide-react";

interface Application { id: string; user_id: string; shop_name: string; contact: string | null; description: string | null; status: string; }
interface Profile { id: string; username: string; balance: number; is_seller: boolean; }
interface TicketRow { id: string; user_id: string; subject: string; message: string; reply: string | null; status: string; }

const Admin = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");

  const load = async () => {
    const [a, u, t] = await Promise.all([
      supabase.from("seller_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,username,balance,is_seller").order("created_at", { ascending: false }).limit(50),
      supabase.from("tickets").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setApps((a.data ?? []) as Application[]);
    setUsers((u.data ?? []) as Profile[]);
    setTickets((t.data ?? []) as TicketRow[]);
  };
  useEffect(() => { load(); }, []);

  const decideApp = async (app: Application, approve: boolean) => {
    await supabase.from("seller_applications").update({ status: approve ? "approved" : "rejected" }).eq("id", app.id);
    if (approve) {
      await supabase.from("user_roles").insert({ user_id: app.user_id, role: "seller" });
      await supabase.from("profiles").update({ is_seller: true, seller_status: "approved" }).eq("id", app.user_id);
    }
    toast.success(approve ? "Seller approved" : "Application rejected");
    load();
  };

  const adjustBalance = async (id: string, delta: number) => {
    const u = users.find((x) => x.id === id); if (!u) return;
    await supabase.from("profiles").update({ balance: Number(u.balance) + delta }).eq("id", id);
    toast.success("Balance updated"); load();
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

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary-glow" />
          <h1 className="font-display text-3xl font-black neon-text">ADMIN PANEL</h1>
        </div>

        <Section icon={Users} title="SELLER APPLICATIONS">
          {apps.length === 0 && <p className="text-sm text-muted-foreground">No applications.</p>}
          <div className="space-y-2">
            {apps.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/40">
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

        <Section icon={Users} title="USERS">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th className="p-2 text-left">Username</th><th className="p-2 text-left">Balance</th><th className="p-2 text-left">Seller</th><th className="p-2 text-right">Adjust balance</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border/40">
                    <td className="p-2">{u.username}</td>
                    <td className="p-2 text-primary-glow font-display">${Number(u.balance).toFixed(2)}</td>
                    <td className="p-2">{u.is_seller ? "✓" : "—"}</td>
                    <td className="p-2 text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => adjustBalance(u.id, 50)}>+$50</Button>
                      <Button size="sm" variant="outline" onClick={() => adjustBalance(u.id, -50)}>−$50</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section icon={Ticket} title="TICKETS">
          <div className="space-y-3">
            {tickets.map((t) => (
              <TicketAdminRow key={t.id} ticket={t} onReply={replyTicket} />
            ))}
            {tickets.length === 0 && <p className="text-sm text-muted-foreground">No tickets.</p>}
          </div>
        </Section>

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
