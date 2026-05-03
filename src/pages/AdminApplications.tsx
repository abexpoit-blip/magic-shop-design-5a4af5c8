import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { sellerAppsApi, appNotesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Users, MessageSquarePlus, Trash2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Application {
  id: string; user_id: string; shop_name: string | null; contact: string | null;
  description: string | null; status: string; telegram?: string | null; jabber?: string | null;
  expected_volume?: string | null; sample_bins?: string | null; message?: string | null;
  admin_note?: string | null; created_at: string;
}

interface AppNote { id: string; application_id: string; author_id: string; note: string; created_at: string; }

const AdminApplications = () => {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Map<string, AppNote[]>>(new Map());

  const load = async () => {
    setLoading(true);
    try {
      const { applications } = await sellerAppsApi.all();
      const list = (applications ?? []) as unknown as Application[];
      setApps(list);
      // Load notes for each application
      const noteMap = new Map<string, AppNote[]>();
      for (const a of list.slice(0, 20)) {
        try {
          const { notes: ns } = await appNotesApi.list(a.id);
          if (ns && (ns as unknown as AppNote[]).length > 0) noteMap.set(a.id, ns as unknown as AppNote[]);
        } catch { /* ignore */ }
      }
      setNotes(noteMap);
    } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addNote = async (applicationId: string, text: string) => {
    if (!user || !text.trim()) return;
    try {
      const { note: n } = await appNotesApi.create(applicationId, text.trim());
      setNotes((m) => {
        const nm = new Map(m);
        nm.set(applicationId, [...(nm.get(applicationId) ?? []), n as unknown as AppNote]);
        return nm;
      });
      toast.success("Note saved");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const deleteNote = async (applicationId: string, noteId: string) => {
    try {
      await appNotesApi.del(applicationId, noteId);
      setNotes((m) => {
        const nm = new Map(m);
        nm.set(applicationId, (nm.get(applicationId) ?? []).filter((x) => x.id !== noteId));
        return nm;
      });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const decide = async (app: Application, approve: boolean, note?: string) => {
    try {
      if (approve) await sellerAppsApi.approve(app.id, note);
      else await sellerAppsApi.reject(app.id, note);
      toast.success(approve ? "Seller approved" : "Application rejected");
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const list = tab === "pending" ? apps.filter((a) => a.status === "pending") : apps;

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
                  tab === t ? "bg-primary/20 border border-primary/60 text-primary-glow" : "bg-secondary/40 border border-border/40 text-muted-foreground"
                }`}>{t === "pending" ? `Pending (${apps.filter((a) => a.status === "pending").length})` : `All (${apps.length})`}</button>
            ))}
          </div>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && list.length === 0 && <p className="text-sm text-muted-foreground">No applications in this view.</p>}

        <div className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className="p-4 rounded-lg bg-secondary/40 border border-border/40">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="space-y-0.5 text-sm min-w-0 flex-1">
                  {a.telegram && <p>📱 Telegram: <span className="font-mono text-primary-glow">{a.telegram}</span></p>}
                  {a.jabber && <p>💬 Jabber: <span className="font-mono text-primary-glow">{a.jabber}</span></p>}
                  {a.expected_volume && <p className="text-xs text-muted-foreground">Volume: {a.expected_volume}</p>}
                  {a.sample_bins && <p className="text-xs text-muted-foreground">BINs: <span className="font-mono">{a.sample_bins}</span></p>}
                  {(a.message || a.description) && <p className="text-xs text-muted-foreground italic mt-1">"{a.message || a.description}"</p>}
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

              {/* Notes */}
              <NotesPanel
                appId={a.id}
                notes={notes.get(a.id) ?? []}
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

const NotesPanel = ({ appId, notes, currentUserId, onAdd, onDelete }: {
  appId: string; notes: AppNote[]; currentUserId?: string;
  onAdd: (text: string) => void | Promise<void>;
  onDelete: (noteId: string) => void | Promise<void>;
}) => {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const submit = async () => { if (!draft.trim()) return; await onAdd(draft); setDraft(""); };
  return (
    <div className="mt-3 pt-3 border-t border-border/40">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-primary-glow transition">
        <StickyNote className="h-3.5 w-3.5" />
        <span className="font-display tracking-wider">ADMIN NOTES ({notes.length})</span>
        <span className="ml-auto text-[10px]">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {notes.length === 0 && <p className="text-[11px] text-muted-foreground italic">No notes yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="p-2.5 rounded-lg bg-background/40 border border-border/30 text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono text-[10px] text-primary-glow">{n.author_id?.slice(0, 8)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                  {n.author_id === currentUserId && (
                    <button onClick={() => { if (confirm("Delete this note?")) onDelete(n.id); }} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-foreground whitespace-pre-wrap">{n.note}</p>
            </div>
          ))}
          <div className="flex gap-2 items-start pt-1">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
              placeholder="Add an internal note…" rows={2} className="bg-input/60 text-xs flex-1" />
            <Button size="sm" onClick={submit} disabled={!draft.trim()} className="bg-gradient-primary">
              <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApplications;
