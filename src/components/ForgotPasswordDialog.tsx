import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { describeAuthError } from "@/lib/authErrors";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultEmail?: string;
  /** "/reset-password" for buyers/sellers, "/admin/reset-password" for admin */
  redirectPath?: string;
}

export const ForgotPasswordDialog = ({ open, onOpenChange, defaultEmail = "", redirectPath = "/reset-password" }: Props) => {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${redirectPath}`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Reset link sent — check your inbox");
    } catch (err) {
      const f = describeAuthError(err);
      toast.error(f.title, f.hint ? { description: f.hint } : undefined);
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSent(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Forgot password</DialogTitle>
          <DialogDescription>
            Enter the email tied to your account. We'll send you a secure reset link.
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="text-sm text-muted-foreground py-2">
            ✅ A reset link is on its way to <span className="text-foreground font-semibold">{email}</span>.
            Check spam if you don't see it within 2 minutes.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Email</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="you@example.com" className="pl-10 h-11 bg-input/70 border-border/60" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-luxe w-full h-11 disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 mx-auto animate-spin" /> : "Send reset link"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
