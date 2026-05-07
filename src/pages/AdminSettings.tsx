import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi, api, clearToken } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Lock, Loader2, AlertTriangle } from "lucide-react";

const AdminSettings = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = "Admin · Credential settings"; }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return toast.error("Enter a new password");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      await adminApi.changePassword(password);
      toast.success("Password updated");
      setPassword(""); setConfirm("");
      toast.info("You'll be signed out — please log in with the new credentials.");
      setTimeout(() => { clearToken(); window.location.href = "/crzr-x9k2-panel"; }, 1500);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  };

  return (
    <AdminLayout title="Credentials">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary-glow" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-black tracking-wide">Admin Credentials</h1>
            <p className="text-xs text-muted-foreground">Update the password for the admin console.</p>
          </div>
        </div>
        <div className="glass-neon rounded-2xl p-6 mb-4 border-gold/30 bg-gold/5">
          <div className="flex gap-3 text-xs text-muted-foreground">
            <AlertTriangle className="h-5 w-5 text-gold shrink-0" />
            <p>Password changes will sign you out — log back in with the new credentials.</p>
          </div>
        </div>
        <form onSubmit={submit} className="glass-neon rounded-2xl p-7 space-y-5">
          <div>
            <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">New password</Label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} placeholder="At least 8 characters" className="pl-10 h-11 bg-input/70 border-border/60" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Confirm new password</Label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password" className="pl-10 h-11 bg-input/70 border-border/60" />
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
