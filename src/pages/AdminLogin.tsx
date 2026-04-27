import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BuildBadge } from "@/components/BuildBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldAlert, Lock, KeyRound, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { describeAuthError } from "@/lib/authErrors";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const AdminLogin = () => {
  const nav = useNavigate();
  const loc = useLocation();
  const fromPath = (loc.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  // Only honor admin-area redirects; ignore anything outside /admin to avoid
  // sending an admin to a public page after their secure login.
  const safeAdminFrom = fromPath && fromPath.startsWith("/admin") && fromPath !== "/admin-login"
    ? fromPath
    : null;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ kind: "info" | "error"; title: string; hint?: string } | null>(null);

  useEffect(() => {
    document.title = "Admin · Secure Console";
  }, []);

  const tryLogin = async (loginEmail: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) throw error;
    return data;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);
    setLoading(true);
    try {
      // Build a list of candidate emails to try, so admins can use either
      // their email OR their username without us hardcoding anything.
      const raw = identifier.trim().toLowerCase();
      const candidates: string[] = [];
      if (EMAIL_PATTERN.test(raw)) {
        candidates.push(raw);
      } else {
        candidates.push(`${raw}@cruzercc.shop`);
        candidates.push(`${raw}@gmail.com`);
      }

      let lastErr: unknown = null;
      let signedIn = false;
      for (const email of candidates) {
        try {
          await tryLogin(email);
          signedIn = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!signedIn) throw lastErr ?? new Error("Login failed");

      // Verify admin role server-side via user_roles. If missing, sign out.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No session after login");
      const { data: roleRows, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (rolesError) throw rolesError;
      const isAdmin = (roleRows ?? []).some((r: { role: string }) => r.role === "admin");
      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error("This account does not have admin privileges.");
      }

      toast.success("Admin console unlocked");
      nav(safeAdminFrom ?? "/admin", { replace: true });
    } catch (err) {
      await supabase.auth.signOut().catch(() => {});
      const message = err instanceof Error ? err.message : "Login failed";
      const friendly = describeAuthError(err);
      const lower = message.toLowerCase();
      if (lower.includes("invalid login") || lower.includes("invalid_grant") || lower.includes("invalid credentials")) {
        setStatusBanner({
          kind: "error",
          title: "Email/username or password is incorrect",
          hint: "If you just rotated the admin info, click 'Bootstrap admin account' below to apply it.",
        });
      } else if (message.includes("admin privileges")) {
        setStatusBanner({ kind: "error", title: "Not an admin account", hint: "This login is for admins only." });
      } else {
        setStatusBanner({ kind: "error", title: friendly.title, hint: friendly.hint });
      }
      toast.error(friendly.title, friendly.hint ? { description: friendly.hint } : undefined);
    } finally { setLoading(false); }
  };

  const provision = async () => {
    setBootstrapping(true);
    setStatusBanner(null);
    try {
      const { data, error } = await supabase.functions.invoke("bootstrap-admin", { body: {} });
      if (error) throw error;
      const res = data as { ok?: boolean; error?: string; email?: string };
      if (res?.error) throw new Error(res.error);
      setStatusBanner({
        kind: "info",
        title: "Admin account is ready",
        hint: res?.email ? `Sign in below using ${res.email} and the configured password.` : "Sign in below.",
      });
      if (res?.email) setIdentifier(res.email);
      toast.success("Admin account ready — sign in below");
    } catch (err) {
      const friendly = describeAuthError(err);
      setStatusBanner({ kind: "error", title: friendly.title, hint: friendly.hint });
      toast.error(friendly.title, friendly.hint ? { description: friendly.hint } : undefined);
    } finally { setBootstrapping(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <BuildBadge />
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-destructive/15 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-6">
        <Link to="/auth" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary-glow mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to user sign-in
        </Link>

        <div className="glass-neon rounded-2xl p-8 border-destructive/30">
          <div className="flex flex-col items-center mb-6">
            <div className="h-14 w-14 rounded-full bg-destructive/15 border border-destructive/40 flex items-center justify-center shadow-[0_0_24px_hsl(var(--destructive)/0.4)]">
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="font-display text-2xl font-black tracking-[0.2em] mt-4 text-foreground">ADMIN CONSOLE</h1>
            <p className="text-[10px] font-mono tracking-[0.4em] text-muted-foreground mt-1">RESTRICTED · AUTHORIZED ONLY</p>
          </div>

          {statusBanner && (
            <div className={`mb-4 rounded-lg border px-3 py-2.5 text-xs ${
              statusBanner.kind === "error"
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-primary/50 bg-primary/10 text-primary-glow"
            }`} role="alert">
              <div className="font-semibold">{statusBanner.title}</div>
              {statusBanner.hint && <div className="opacity-80 mt-0.5">{statusBanner.hint}</div>}
            </div>
          )}

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
              className="w-full h-12 rounded-lg bg-gradient-to-r from-destructive to-destructive/70 text-white font-display tracking-wider uppercase text-sm shadow-[0_0_24px_hsl(var(--destructive)/0.4)] hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Verifying…" : "Unlock Console"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button type="button" onClick={() => setForgotOpen(true)}
              className="text-xs text-muted-foreground hover:text-primary-glow underline-offset-4 hover:underline">
              Forgot admin password?
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-border/40 text-center">
            <p className="text-[10px] text-muted-foreground mb-2">First time, or just rotated admin info? Apply the configured secrets.</p>
            <button type="button" onClick={provision} disabled={bootstrapping}
              className="text-xs text-primary-glow hover:text-primary underline-offset-4 hover:underline disabled:opacity-50">
              {bootstrapping ? "Provisioning…" : "Bootstrap / refresh admin account"}
            </button>
          </div>
        </div>

        <ForgotPasswordDialog
          open={forgotOpen}
          onOpenChange={setForgotOpen}
          defaultEmail={identifier.includes("@") ? identifier : ""}
          redirectPath="/admin/reset-password"
        />

        <p className="text-center text-[9px] font-mono tracking-[0.3em] text-muted-foreground mt-5">
          UNAUTHORIZED ACCESS LOGGED · IP MONITORED
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
