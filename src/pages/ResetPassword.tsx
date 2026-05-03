import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import { BuildBadge } from "@/components/BuildBadge";

const ResetPassword = () => {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // Extract token from URL hash (?token=xxx or #token=xxx)
  const params = new URLSearchParams(window.location.search || window.location.hash.replace("#", "?"));
  const resetToken = params.get("token");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token: resetToken, password });
      toast.success("Password updated — please sign in with your new password");
      nav("/auth");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <BuildBadge />
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="relative z-10 w-full max-w-md p-6">
        <div className="glass-neon rounded-2xl p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="h-14 w-14 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-primary-glow" />
            </div>
            <h1 className="font-display text-2xl font-black tracking-[0.2em] mt-4">RESET PASSWORD</h1>
            <p className="text-[10px] font-mono tracking-[0.4em] text-muted-foreground mt-1">CHOOSE A NEW PASSWORD</p>
          </div>

          {!resetToken ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              No reset token found. Please request a new reset link from the sign-in page.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">New password</Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    required minLength={8} placeholder="••••••••"
                    className="pl-10 h-11 bg-input/70 border-border/60" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Confirm password</Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    required minLength={8} placeholder="••••••••"
                    className="pl-10 h-11 bg-input/70 border-border/60" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-luxe w-full h-12 disabled:opacity-60">
                {loading ? <Loader2 className="h-4 w-4 mx-auto animate-spin" /> : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
