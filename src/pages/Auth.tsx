import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Captcha } from "@/components/Captcha";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, User as UserIcon, Mail } from "lucide-react";
import logo from "@/assets/scorpion-logo.png";
import bg from "@/assets/auth-bg.jpg";

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
        const fakeEmail = email || `${username.toLowerCase()}@scorpion.shop`;
        const { error } = await supabase.auth.signUp({
          email: fakeEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { username },
          },
        });
        if (error) throw error;
        toast.success("Account created — signing you in…");
        nav("/");
      } else {
        // Login: accept either username or email; map username to fake email
        const loginEmail = username.includes("@") ? username : `${username.toLowerCase()}@scorpion.shop`;
        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back");
        nav("/");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" />
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-glow pointer-events-none" />

      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Scorpion logo" width={96} height={96}
            className="h-24 w-24 drop-shadow-[0_0_30px_hsl(354_84%_52%/0.7)] animate-pulse-glow rounded-full" />
          <h1 className="font-display text-4xl font-black neon-text mt-4">SCORPION</h1>
          <p className="text-xs tracking-[0.4em] text-muted-foreground mt-1">PREMIUM CARDS MARKETPLACE</p>
        </div>

        <div className="glass-neon rounded-2xl p-7">
          <div className="flex gap-2 mb-6 p-1 rounded-lg bg-secondary/40">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                  mode === m ? "bg-gradient-primary text-primary-foreground shadow-neon" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground mb-5">
            Telegram channel: <span className="text-primary-glow">@scorpionccstore01</span>
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Username</Label>
              <div className="relative mt-1.5">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="username"
                  className="pl-10 bg-input/60 border-border/60" />
              </div>
            </div>

            {mode === "signup" && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email (optional)</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                    className="pl-10 bg-input/60 border-border/60" />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  placeholder="••••••••" className="pl-10 bg-input/60 border-border/60" />
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Verification code</Label>
              <div className="mt-1.5">
                <Captcha value={captcha} onChange={setCaptcha} onValidChange={setCaptchaOk} />
              </div>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full h-11 bg-gradient-primary hover:opacity-90 text-primary-foreground font-display tracking-wider shadow-neon">
              {loading ? "Please wait…" : mode === "login" ? "LOG IN" : "SIGN UP"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2026 Scorpion-Shop · All rights reserved
        </p>
      </div>
    </div>
  );
};

export default Auth;
