import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { authApi, setToken, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldAlert, Lock, KeyRound, Loader2, ArrowLeft, ArrowRight, AlertCircle, WifiOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_LOGIN_URL = "https://cruzercc.shop/crzr-x9k2-panel";
const API_BASE_URL = "https://cruzercc.shop/api";

const AdminLogin = () => {
  const nav = useNavigate();
  const loc = useLocation();
  const { profile, user, loading: authLoading } = useAuth();
  const fromPath = (loc.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const safeAdminFrom = fromPath && fromPath.startsWith("/admin") && fromPath !== "/crzr-x9k2-panel"
    ? fromPath
    : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);

  // If already logged in as admin, redirect
  useEffect(() => {
    if (!authLoading && user && profile?.role === "admin") {
      nav(safeAdminFrom ?? "/admin", { replace: true });
    }
  }, [authLoading, user, profile]);

  useEffect(() => {
    document.title = "Admin · Secure Console";
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authApi.adminLogin({
        identifier: email.trim().toLowerCase(),
        password,
      });

      // Verify admin role
      if (result.user.role !== "admin") {
        throw new Error("This account does not have admin privileges.");
      }

      setToken(result.token);
      toast.success("Admin console unlocked");
      setTimeout(() => nav(safeAdminFrom ?? "/admin", { replace: true }), 100);
    } catch (err) {
      let title = "Login failed";
      let detail: string | undefined;

      if (err instanceof ApiError) {
        if (err.status === 0) {
          title = "Cannot reach server";
          detail = `The backend at ${API_BASE_URL} is unreachable. Check that nginx is proxying /api and the Node server is running on your VPS.`;
        } else if (err.status === 401) {
          title = "Invalid credentials";
          detail = "Check your email and password.";
        } else if (err.status === 403) {
          title = "Not an admin account";
          detail = "This login is reserved for admin accounts only.";
        } else if (err.contentType?.includes("text/html")) {
          title = "Server misconfigured";
          detail = `The API returned HTML instead of JSON (HTTP ${err.status}). Your nginx is not proxying /api to the backend.`;
        } else {
          title = err.message;
        }
      } else if (err instanceof Error) {
        title = err.message;
      }

      setError({ title, detail });
      toast.error(title);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-destructive/15 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-6">
        <Link to="/auth" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary-glow mb-4 transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to user sign-in
        </Link>

        <div className="glass-neon rounded-2xl p-8 border-destructive/30">
          {/* Header */}
          <div className="flex flex-col items-center mb-6">
            <div className="h-14 w-14 rounded-full bg-destructive/15 border border-destructive/40 flex items-center justify-center shadow-[0_0_24px_hsl(var(--destructive)/0.4)]">
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="font-display text-2xl font-black tracking-[0.2em] mt-4 text-foreground">ADMIN CONSOLE</h1>
            <p className="text-[10px] font-mono tracking-[0.4em] text-muted-foreground mt-1">RESTRICTED · AUTHORIZED ONLY</p>
          </div>

          {/* Redirect notice */}
          {safeAdminFrom && (
            <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-xs text-primary-glow flex items-start gap-2">
              <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>After sign-in you'll be redirected to <span className="font-mono underline">{safeAdminFrom}</span></span>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-xs text-destructive" role="alert">
              <div className="flex items-center gap-2 font-semibold">
                {error.title.includes("reach") ? <WifiOff className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                {error.title}
              </div>
              {error.detail && <p className="mt-1 opacity-80">{error.detail}</p>}
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Admin email</Label>
              <div className="relative mt-2">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="admin@example.com"
                  className="pl-10 h-11 bg-input/70 border-border/60"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Password</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-10 h-11 bg-input/70 border-border/60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-lg bg-gradient-to-r from-destructive to-destructive/70 text-white font-display tracking-wider uppercase text-sm shadow-[0_0_24px_hsl(var(--destructive)/0.4)] hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Verifying…" : "Unlock Console"}
            </button>
          </form>
        </div>

        <p className="text-center text-[9px] font-mono tracking-[0.3em] text-muted-foreground mt-5">
          UNAUTHORIZED ACCESS LOGGED · IP MONITORED
        </p>
        <p className="text-center text-[10px] text-muted-foreground mt-2">
          Admin login URL: <a href={ADMIN_LOGIN_URL} className="text-primary-glow underline underline-offset-4">{ADMIN_LOGIN_URL}</a>
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
