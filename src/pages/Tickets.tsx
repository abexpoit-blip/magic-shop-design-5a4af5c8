import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ticketsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LifeBuoy, Plus } from "lucide-react";
import { toast } from "sonner";

interface Ticket { id: string; subject: string; message: string; reply: string | null; status: string; created_at: string; }

const Tickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!user) return;
    try {
      const { tickets: t } = await ticketsApi.mine();
      setTickets((t ?? []) as unknown as Ticket[]);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, [user]);

  const submit = async () => {
    if (!user || !subject || !message) return;
    try {
      await ticketsApi.create({ subject, body: message });
      toast.success("Ticket created");
      setSubject(""); setMessage(""); setOpen(false); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-black neon-text">SUPPORT TICKETS</h1>
          <Button onClick={() => setOpen(!open)} className="bg-gradient-primary shadow-neon">
            <Plus className="h-4 w-4 mr-1" /> New ticket
          </Button>
        </div>

        {open && (
          <section className="glass-neon rounded-2xl p-6 space-y-3">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="bg-input/60" />
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue…" rows={4} className="bg-input/60" />
            <Button onClick={submit} className="bg-gradient-primary shadow-neon">Submit</Button>
          </section>
        )}

        <div className="space-y-3">
          {tickets.map((t) => (
            <article key={t.id} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-display font-bold">{t.subject}</h3>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${t.status === "open" ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}>
                  {t.status}
                </span>
              </div>
              <p className="text-sm text-foreground/80">{t.message}</p>
              {t.reply && (
                <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <p className="text-[10px] uppercase tracking-wider text-primary-glow mb-1">Admin reply</p>
                  <p className="text-sm text-foreground/90">{t.reply}</p>
                </div>
              )}
            </article>
          ))}
          {tickets.length === 0 && (
            <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
              <LifeBuoy className="h-10 w-10 mx-auto mb-3" />
              No tickets yet.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default Tickets;
