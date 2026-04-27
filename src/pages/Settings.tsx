import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getSavedAccounts, removeSavedAccount, switchAccount, type SavedAccount } from "@/lib/accountSwitcher";
import { Users, X, LogIn, Plus } from "lucide-react";

const Settings = () => {
  const { user, profile, refresh, roles } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [shopName, setShopName] = useState("");
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");
  const [pwd, setPwd] = useState("");
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => { setAccounts(getSavedAccounts()); }, []);
  const removeAcc = (email: string) => { removeSavedAccount(email); setAccounts(getSavedAccounts()); };

  const saveProfile = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    toast.success("Profile updated");
    await refresh();
  };

  const changePassword = async () => {
    if (pwd.length < 6) return toast.error("Password must be at least 6 characters");
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) return toast.error(error.message);
    toast.success("Password changed");
    setPwd("");
  };

  const applySeller = async () => {
    if (!user || !shopName) return toast.error("Shop name required");
    const { error } = await supabase.from("seller_applications").insert({
      user_id: user.id, shop_name: shopName, contact, description,
    });
    if (error) return toast.error(error.message);
    toast.success("Application submitted — admin will review it");
    setShopName(""); setContact(""); setDescription("");
  };

  const isSeller = roles.includes("seller") || roles.includes("admin");

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <h1 className="font-display text-3xl font-black neon-text">SETTINGS</h1>

        <section className="glass rounded-2xl p-6 space-y-3">
          <h2 className="font-display tracking-wider text-primary-glow">PROFILE</h2>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Username</label>
            <Input value={profile?.username ?? ""} disabled className="bg-input/60 mt-1.5 opacity-60" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Display name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-input/60 mt-1.5" />
          </div>
          <Button onClick={saveProfile} className="bg-gradient-primary shadow-neon">Save</Button>
        </section>

        <section className="glass rounded-2xl p-6 space-y-3">
          <h2 className="font-display tracking-wider text-primary-glow">PASSWORD</h2>
          <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="New password" className="bg-input/60" />
          <Button onClick={changePassword} className="bg-gradient-primary shadow-neon">Change password</Button>
        </section>

        {!isSeller && (
          <section className="glass-neon rounded-2xl p-6 space-y-3">
            <h2 className="font-display tracking-wider text-primary-glow">BECOME A SELLER</h2>
            <p className="text-sm text-muted-foreground">Apply to list your own cards. Admin will review your request.</p>
            <Input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Shop name" className="bg-input/60" />
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Telegram contact" className="bg-input/60" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell us about your inventory…" rows={4} className="bg-input/60" />
            <Button onClick={applySeller} className="bg-gradient-primary shadow-neon">Submit application</Button>
          </section>
        )}

        <section className="glass rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-glow" />
            <h2 className="font-display tracking-wider text-primary-glow">SAVED ACCOUNTS</h2>
          </div>
          <p className="text-xs text-muted-foreground">Quickly switch between accounts you've signed into on this device.</p>
          {accounts.length === 0 && <p className="text-sm text-muted-foreground">No saved accounts yet.</p>}
          <div className="space-y-2">
            {accounts.map((acc) => {
              const isCurrent = acc.email === user?.email;
              return (
                <div key={acc.email} className={`flex items-center gap-3 p-3 rounded-lg border ${isCurrent ? "bg-primary/10 border-primary/40" : "bg-secondary/40 border-border/50"}`}>
                  <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                    {acc.username[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {acc.username} {isCurrent && <span className="text-[10px] text-primary-glow uppercase tracking-wider ml-1">· current</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{acc.role} · {acc.email}</div>
                  </div>
                  {!isCurrent && (
                    <Button size="sm" variant="outline" onClick={() => switchAccount(acc.email)}>
                      <LogIn className="h-3 w-3 mr-1" />Switch
                    </Button>
                  )}
                  <button onClick={() => removeAcc(acc.email)} className="text-muted-foreground hover:text-destructive p-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <Button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }} variant="outline" className="w-full mt-2">
            <Plus className="h-3 w-3 mr-1" />Sign in with another account
          </Button>
        </section>
      </div>
    </AppShell>
  );
};

export default Settings;
