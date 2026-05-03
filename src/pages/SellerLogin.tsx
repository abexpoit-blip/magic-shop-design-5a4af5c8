import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, setToken, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Captcha } from "@/components/Captcha";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, User as UserIcon, Package } from "lucide-react";
import logo from "@/assets/panther-logo.png";
import { Loader2 } from "lucide-react";

const SellerLogin = () => {
  const nav = useNavigate();
  const { profile, user, loading: authLoading } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaOk, setCaptchaOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);

  useEffect(() => {
    if (!authLoading && user && (profile?.role === "seller" || profile?.role === "admin")) {
      nav("/seller", { replace: true });
    }
  }, [authLoading, user, profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!captchaOk) {
      toast.error("Verification code is incorrect");
      return;
    }
    setLoading(true);
    try {
      const result = await authApi.sellerLogin({
        identifier: username.trim(),
        password,
      });

      if (result.user.role !== "seller" && result.user.role !== "admin") {
        throw new Error("This account does not have seller privileges.");
      }

      setToken(result.token);
      toast.success("Welcome back, seller");
      nav("/seller", { replace: true });
    } catch (err: unknown) {
      let title = "Login failed";
      let detail: string | undefined;
      if (err instanceof ApiError) {
        if (err.status === 401) {
          title = "Invalid credentials";
          detail = "Check your username and password.";
        } else if (err.status === 403) {
          title = "Not a seller account";
          detail = "This login is for approved sellers only. Apply first on the buyer portal.";
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-gold/20 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/15 blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md p-6 animate-fade-up relative z-10">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="cruzercc.shop" width={72} height={72}
            className="h-16 w-16 drop-shadow-[0_0_24px_hsl(43_92%_62%/0.7)]" />
          <h1 className="font-display text-2xl font-black gold-text mt-4 tracking-[0.18em]">SELLER LOGIN</h1>
          <p className="text-[10px] font-mono tracking-[0.4em] text-muted-foreground mt-1">CRUZERCC.SHOP · SELLER PORTAL</p>
        </div>

        <div className="glass-neon rounded-2xl p-7">
          <div className="flex items-center gap-2 mb-5 p-3 rounded-xl bg-gold/10 border border-gold/30">
            <Package className="h-4 w-4 text-gold" />
            <span className="text-xs text-gold/90 font-medium">Approved sellers only</span>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-xs text-destructive" role="alert">
              <div className="font-semibold">{error.title}</div>
              {error.detail && <div className="opacity-80 mt-0.5">{error.detail}</div>}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Username or Email</Label>
              <div className="relative mt-2">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="seller_name"
                  className="pl-10 h-11 bg-input/70 border-border/60" />
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Password</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  placeholder="••••••••" className="pl-10 h-11 bg-input/70 border-border/60" />
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Verification</Label>
              <div className="mt-2">
                <Captcha value={captcha} onChange={setCaptcha} onValidChange={setCaptchaOk} />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-12 rounded-xl font-semibold tracking-wide text-sm bg-gradient-gold text-gold-foreground hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-[0_0_24px_hsl(43_92%_62%/0.3)]">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in as Seller"}
            </button>
          </form>

          <div className="mt-5 text-center space-y-2">
            <button onClick={() => nav("/auth")} className="text-xs text-muted-foreground hover:text-foreground transition">
              ← Back to buyer login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerLogin;
