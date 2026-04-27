import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Captcha } from "@/components/Captcha";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, User as UserIcon, Mail, ShieldCheck, Zap, Crown } from "lucide-react";
import logo from "@/assets/panther-logo.png";

const Auth = () => {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaOk, setCaptchaOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaOk) return toast.error("Verification code is incorrect");
    setLoading(true);
    try {
      if (mode === "signup") {
        const fakeEmail = email || `${username.toLowerCase()}@blackpanther.shop`;
        const { error } = await supabase.auth.signUp({
          email: fakeEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { username },
          },
        });
        if (error) throw error;
        toast.success("Account created — entering the den…");
        nav("/");
      } else {
        const loginEmail = username.includes("@") ? username : `${username.toLowerCase()}@blackpanther.shop`;
        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back, hunter");
        nav("/");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-stretch relative overflow-hidden bg-background">
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/25 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-gold/15 blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

      <div className="hidden lg:flex flex-col justify-between w-[48%] p-14 relative z-10">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Black Panther" width={56} height={56}
            className="h-14 w-14 drop-shadow-[0_0_24px_hsl(268_90%_60%/0.7)] animate-float" />
          <div>
            <div className="font-display text-2xl font-black neon-text tracking-[0.18em]">BLACK PANTHER</div>
            <div className="text-[10px] font-mono tracking-[0.4em] text-gold/80 mt-1">CMS · MARKETPLACE</div>
          </div>
        </div>

        <div>
          <h1 className="font-display text-6xl xl:text-7xl font-black leading-[1.05] mb-6">
            <span className="block text-foreground">STALK.</span>
            <span className="block neon-text">STRIKE.</span>
            <span className="block gold-text">SUCCEED.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
            A premium content & commerce platform for elite traders.
            Verified inventory, instant settlement, vibranium-grade security.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            <Feature icon={ShieldCheck} label="Vault-grade" />
            <Feature icon={Zap} label="Instant" />
            <Feature icon={Crown} label="Curated" />
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-mono tracking-wider">
          © {new Date().getFullYear()} BLACK PANTHER · ALL RIGHTS RESERVED
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md animate-fade-up">
          <div className="lg:hidden flex flex-col items-center mb-6">
            <img src={logo} alt="Black Panther logo" width={84} height={84}
              className="h-20 w-20 drop-shadow-[0_0_24px_hsl(268_90%_60%/0.7)] animate-pulse-glow" />
            <h1 className="font-display text-3xl font-black neon-text mt-4 tracking-[0.18em]">BLACK PANTHER</h1>
            <p className="text-[10px] font-mono tracking-[0.4em] text-gold/80 mt-1">CMS · MARKETPLACE</p>
          </div>

          <div className="glass-neon rounded-2xl p-7 panther-claw">
            <div className="flex gap-2 mb-6 p-1 rounded-xl bg-secondary/50 border border-border/50">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition ${
                    mode === m ? "bg-gradient-primary text-primary-foreground shadow-neon" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground mb-5">
              Telegram: <span className="gold-text font-semibold">@blackpanther_cms</span>
            </p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Username</Label>
                <div className="relative mt-2">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="hunter"
                    className="pl-10 h-11 bg-input/70 border-border/60" />
                </div>
              </div>

              {mode === "signup" && (
                <div>
                  <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Email (optional)</Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                      className="pl-10 h-11 bg-input/70 border-border/60" />
                  </div>
                </div>
              )}

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

              <Button type="submit" disabled={loading}
                className="w-full h-12 bg-gradient-primary hover:opacity-95 text-primary-foreground font-display tracking-[0.2em] shadow-neon text-sm">
                {loading ? "PLEASE WAIT…" : mode === "login" ? "ENTER THE DEN" : "JOIN THE PRIDE"}
              </Button>
            </form>
          </div>

          <p className="text-center text-[10px] font-mono tracking-[0.3em] text-muted-foreground mt-6 lg:hidden">
            © {new Date().getFullYear()} BLACK PANTHER
          </p>
        </div>
      </div>
    </div>
  );
};

const Feature = ({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) => (
  <div className="glass rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-primary/40 transition">
    <Icon className="h-5 w-5 text-primary-glow" />
    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
  </div>
);

export default Auth;
