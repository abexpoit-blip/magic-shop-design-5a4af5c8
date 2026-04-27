import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldAlert, Lock, KeyRound, Loader2 } from "lucide-react";

const AdminLogin = () => {
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    document.title = "Admin · Secure Console";
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loginEmail = identifier.includes("@") ? identifier : `${identifier.toLowerCase()}@cruzercc.shop`;
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error) throw error;
      // Verify the user is actually an admin before letting them in.
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user!.id);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error("This account does not have admin access");
      }
      toast.success("Admin console unlocked");
      nav("/admin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally { setLoading(false); }
  };

  const provision = async () => {
    setBootstrapping(true);
    try {
      const { data, error } = await supabase.functions.invoke("bootstrap-admin", { body: {} });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Admin account ready — sign in below");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bootstrap failed");
    } finally { setBootstrapping(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-destructive/15 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-6">
        <div className="glass-neon rounded-2xl p-8 border-destructive/30">
          <div className="flex flex-col items-center mb-6">
            <div className="h-14 w-14 rounded-full bg-destructive/15 border border-destructive/40 flex items-center justify-center shadow-[0_0_24px_hsl(var(--destructive)/0.4)]">
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="font-display text-2xl font-black tracking-[0.2em] mt-4 text-foreground">ADMIN CONSOLE</h1>
            <p className="text-[10px] font-mono tracking-[0.4em] text-muted-foreground mt-1">RESTRICTED · AUTHORIZED ONLY</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Admin email or username</Label>
              <div className="relative mt-2">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username"
                  placeholder="admin@example.com" className="pl-10 h-11 bg-input/70 border-border/60" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Password</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  autoComplete="current-password" placeholder="••••••••" className="pl-10 h-11 bg-input/70 border-border/60" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-12 rounded-lg bg-gradient-to-r from-destructive to-destructive/70 text-white font-display tracking-wider uppercase text-sm shadow-[0_0_24px_hsl(var(--destructive)/0.4)] hover:opacity-90 disabled:opacity-50 transition">
              {loading ? <Loader2 className="h-4 w-4 mx-auto animate-spin" /> : "Unlock Console"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border/40 text-center">
            <p className="text-[10px] text-muted-foreground mb-2">First-time setup? Provision the admin account from configured secrets.</p>
            <button type="button" onClick={provision} disabled={bootstrapping}
              className="text-xs text-primary-glow hover:text-primary underline-offset-4 hover:underline disabled:opacity-50">
              {bootstrapping ? "Provisioning…" : "Bootstrap admin account"}
            </button>
          </div>
        </div>

        <p className="text-center text-[9px] font-mono tracking-[0.3em] text-muted-foreground mt-5">
          UNAUTHORIZED ACCESS LOGGED · IP MONITORED
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
