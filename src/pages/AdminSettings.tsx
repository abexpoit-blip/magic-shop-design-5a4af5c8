import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Mail, User as UserIcon, Lock, Loader2, AlertTriangle } from "lucide-react";
import { describeAuthError } from "@/lib/authErrors";

const AdminSettings = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Admin · Credential settings";
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? "");
        const meta = data.user.user_metadata as { username?: string } | null;
        setUsername(meta?.username ?? "");
      }
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password && password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password && password !== confirm) return toast.error("Passwords don't match");

    const payload: Record<string, string> = {};
    if (email) payload.email = email.trim();
    if (username) payload.username = username.trim();
    if (password) payload.password = password;

    if (Object.keys(payload).length === 0) return toast.error("Nothing to update");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-admin-credentials", { body: payload });
      if (error) throw error;
      const res = data as { ok?: boolean; error?: string; secrets_synced?: boolean; note?: string };
      if (res?.error) throw new Error(res.error);

      toast.success("Admin credentials updated", { description: res?.note });
      setPassword("");
      setConfirm("");
      if (payload.password || payload.email) {
        toast.info("You'll be signed out — please log in with the new credentials.");
        setTimeout(async () => {
          await supabase.auth.signOut();
          window.location.href = "/admin-login";
        }, 1500);
      }
    } catch (err) {
      const f = describeAuthError(err);
      toast.error(f.title, f.hint ? { description: f.hint } : undefined);
    } finally { setLoading(false); }
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary-glow" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-black tracking-wide">Admin Credentials</h1>
            <p className="text-xs text-muted-foreground">Update the email, username, and password for the admin console.</p>
          </div>
        </div>

        <div className="glass-neon rounded-2xl p-6 mb-4 border-gold/30 bg-gold/5">
          <div className="flex gap-3 text-xs text-muted-foreground">
            <AlertTriangle className="h-5 w-5 text-gold shrink-0" />
            <div>
              <p className="text-foreground font-semibold mb-1">Security notice</p>
              <p>Changes apply to the live admin account immediately and sync to backend secrets. Email or password changes will sign you out — log back in with the new credentials.</p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="glass-neon rounded-2xl p-7 space-y-5">
          <div>
            <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Admin email</Label>
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="pl-10 h-11 bg-input/70 border-border/60" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Username</Label>
            <div className="relative mt-2">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={username} onChange={(e) => setUsername(e.target.value)} required
                className="pl-10 h-11 bg-input/70 border-border/60" />
            </div>
          </div>
          <div className="border-t border-border/40 pt-5">
            <p className="text-xs text-muted-foreground mb-3">Leave blank to keep the current password.</p>
            <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">New password</Label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                minLength={8} autoComplete="new-password" placeholder="At least 8 characters"
                className="pl-10 h-11 bg-input/70 border-border/60" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Confirm new password</Label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password" placeholder="Repeat new password"
                className="pl-10 h-11 bg-input/70 border-border/60" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-luxe w-full h-12 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 mx-auto animate-spin" /> : "Save credentials"}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
