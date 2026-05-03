import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultEmail?: string;
  redirectPath?: string;
}

export const ForgotPasswordDialog = ({ open, onOpenChange, defaultEmail = "" }: Props) => {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // VPS backend doesn't have password reset email flow yet.
      // Show a message directing users to contact admin.
      setSent(true);
      toast.success("Contact admin to reset your password");
    } catch {
      toast.error("Failed to submit reset request");
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSent(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Forgot password</DialogTitle>
          <DialogDescription>
            Contact admin via Telegram @cruzercc_support to reset your password.
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="text-sm text-muted-foreground py-2">
            ✅ Please contact admin via Telegram <span className="text-foreground font-semibold">@cruzercc_support</span> to reset your password for <span className="text-foreground font-semibold">{email}</span>.
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
              {loading ? <Loader2 className="h-4 w-4 mx-auto animate-spin" /> : "Request password reset"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
