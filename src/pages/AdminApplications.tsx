import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Users, MessageSquarePlus, Trash2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface AppNote {
  id: string; application_id: string; author_id: string; note: string; created_at: string;
}
interface Profile { id: string; username: string; }

interface Application {
  id: string; user_id: string; shop_name: string | null; contact: string | null;
  description: string | null; status: string; telegram?: string | null; jabber?: string | null;
  expected_volume?: string | null; sample_bins?: string | null; message?: string | null;
  admin_note?: string | null; created_at: string;
}

const AdminApplications = () => {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Map<string, AppNote[]>>(new Map());
  const [authors, setAuthors] = useState<Map<string, Profile>>(new Map());

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("seller_applications").select("*").order("created_at", { ascending: false });
    const list = (data ?? []) as Application[];
    setApps(list);
    setLoading(false);

    if (list.length > 0) {
      const { data: ns } = await (supabase.from("application_notes" as never) as any)
        .select("*").in("application_id", list.map((a) => a.id)).order("created_at", { ascending: true });
      const map = new Map<string, AppNote[]>();
      ((ns ?? []) as AppNote[]).forEach((n) => {
        if (!map.has(n.application_id)) map.set(n.application_id, []);
        map.get(n.application_id)!.push(n);
      });
      setNotes(map);

      const authorIds = Array.from(new Set(((ns ?? []) as AppNote[]).map((n) => n.author_id)));
      if (authorIds.length > 0) {
        const { data: ps } = await supabase.from("profiles").select("id,username").in("id", authorIds);
        setAuthors(new Map((ps ?? []).map((p: any) => [p.id, p])));
      }
    } else {
      setNotes(new Map());
    }
  };
  useEffect(() => { load(); }, []);

  const addNote = async (applicationId: string, text: string) => {
    if (!user || !text.trim()) return;
    const { data, error } = await (supabase.from("application_notes" as never) as any)
      .insert({ application_id: applicationId, author_id: user.id, note: text.trim() })
      .select().single();
    if (error) return toast.error(error.message);
    setNotes((m) => {
      const n = new Map(m);
      const arr = n.get(applicationId) ?? [];
      n.set(applicationId, [...arr, data as AppNote]);
      return n;
    });
    if (user && !authors.has(user.id)) {
      const { data: me } = await supabase.from("profiles").select("id,username").eq("id", user.id).maybeSingle();
      if (me) setAuthors((a) => new Map(a).set(me.id, me as Profile));
    }
    toast.success("Note saved");
  };

  const deleteNote = async (applicationId: string, noteId: string) => {
    const { error } = await (supabase.from("application_notes" as never) as any).delete().eq("id", noteId);
    if (error) return toast.error(error.message);
    setNotes((m) => {
      const n = new Map(m);
      n.set(applicationId, (n.get(applicationId) ?? []).filter((x) => x.id !== noteId));
      return n;
    });
  };

  const decide = async (app: Application, approve: boolean, note?: string) => {
    const { error } = await (supabase.from("seller_applications") as any).update({
      status: approve ? "approved" : "rejected",
      admin_note: note ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", app.id);
    if (error) return toast.error(error.message);
    if (approve) {
      await supabase.from("user_roles").insert({ user_id: app.user_id, role: "seller" });
      await (supabase.from("profiles") as any).update({ is_seller: true, seller_status: "approved" }).eq("id", app.user_id);
    }
    toast.success(approve ? "Seller approved" : "Application rejected");
    load();
  };

  const list = tab === "pending" ? apps.filter((a) => a.status === "pending") : apps;
  const counts = {
    pending: apps.filter((a) => a.status === "pending").length,
    approved: apps.filter((a) => a.status === "approved").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
  };

  return (
    <AdminLayout title="Seller Applications">
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Users className="h-4 w-4 text-primary-glow" />
          <h2 className="font-display tracking-wider text-primary-glow">REVIEW QUEUE</h2>
          <div className="ml-auto flex gap-2">
            {(["pending", "all"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider transition ${
                  tab === t ? "bg-primary/20 border border-primary/60 text-primary-glow" : "bg-secondary/40 border border-border/40 text-muted-foreground hover:bg-secondary/60"
                }`}>{t === "pending" ? `Pending (${counts.pending})` : `All (${apps.length})`}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
          <Stat label="Pending" value={counts.pending} tone="warning" />
          <Stat label="Approved" value={counts.approved} tone="success" />
          <Stat label="Rejected" value={counts.rejected} tone="muted" />
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && list.length === 0 && <p className="text-sm text-muted-foreground">No applications in this view.</p>}

        <div className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className="p-4 rounded-lg bg-secondary/40 border border-border/40">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="space-y-0.5 text-sm min-w-0 flex-1">
                  {a.shop_name && <p className="font-display text-base text-primary-glow">{a.shop_name}</p>}
                  {a.telegram && <p>📱 Telegram: <span className="font-mono text-primary-glow">{a.telegram}</span></p>}
                  {a.jabber && <p>💬 Jabber: <span className="font-mono text-primary-glow">{a.jabber}</span></p>}
                  {a.contact && <p className="text-xs text-muted-foreground">Contact: {a.contact}</p>}
                  {a.expected_volume && <p className="text-xs text-muted-foreground">Volume: {a.expected_volume}</p>}
                  {a.sample_bins && <p className="text-xs text-muted-foreground">BINs: <span className="font-mono">{a.sample_bins}</span></p>}
                  {(a.message || a.description) && <p className="text-xs text-muted-foreground italic mt-1">"{a.message || a.description}"</p>}
                  {a.admin_note && <p className="text-xs text-warning mt-1">Admin note: {a.admin_note}</p>}
                  <p className="text-[10px] mt-2">
                    status: <span className={a.status === "pending" ? "text-warning" : a.status === "approved" ? "text-success" : "text-destructive"}>{a.status}</span>
                    {" · "}{new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                {a.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(a, true)} className="bg-success text-white">
                      <Check className="h-3 w-3 mr-1" />Approve
                    </Button>
                    <Button size="sm" variant="destructive"
                      onClick={() => { const note = prompt("Reason for rejection (optional):") ?? undefined; decide(a, false, note); }}>
                      <X className="h-3 w-3 mr-1" />Reject
                    </Button>
                  </div>
                )}
              </div>

              <NotesPanel
                appId={a.id}
                notes={notes.get(a.id) ?? []}
                authors={authors}
                currentUserId={user?.id}
                onAdd={(t) => addNote(a.id, t)}
                onDelete={(noteId) => deleteNote(a.id, noteId)}
              />
            </div>
          ))}
        </div>
      </section>
    </AdminLayout>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: number; tone: "warning" | "success" | "muted" }) => {
  const color = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-muted-foreground";
  return (
    <div className="rounded-lg bg-secondary/30 border border-border/40 p-3">
      <p className={`font-display text-xl ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
    </div>
  );
};

export default AdminApplications;
