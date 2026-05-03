import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { profileApi, api, sellerAppsApi, clearToken } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getSavedAccounts, removeSavedAccount, switchAccount, type SavedAccount } from "@/lib/accountSwitcher";
import { Users, X, LogIn, Plus, Send } from "lucide-react";

const Settings = () => {
  const { user, profile, refresh, roles } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [pwd, setPwd] = useState("");
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);

  // Seller application (hidden section — only visible to non-sellers)
  const [shopName, setShopName] = useState("");
  const [telegram, setTelegram] = useState("");
  const [jabber, setJabber] = useState("");
  const [expectedVolume, setExpectedVolume] = useState("");
  const [sampleBins, setSampleBins] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { setAccounts(getSavedAccounts()); }, []);
  const removeAcc = (email: string) => { removeSavedAccount(email); setAccounts(getSavedAccounts()); };

  const saveProfile = async () => {
    if (!user) return;
    try {
      await profileApi.update({ display_name: displayName });
      toast.success("Profile updated");
      await refresh();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  };

  const changePassword = async () => {
    if (pwd.length < 6) return toast.error("Password must be at least 6 characters");
    try {
      await api.post("/auth/change-password", { password: pwd });
      toast.success("Password changed");
      setPwd("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const applySeller = async () => {
    if (!user) return;
    if (!telegram && !jabber) return toast.error("Provide at least Telegram or Jabber");
    try {
      await sellerAppsApi.submit({
        telegram, jabber, expected_volume: expectedVolume,
        sample_bins: sampleBins, message,
      });
      toast.success("Application submitted — admin will review it");
      setShopName(""); setTelegram(""); setJabber("");
      setExpectedVolume(""); setSampleBins(""); setMessage("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Submit failed"); }
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

        {/* Seller application — hidden inside buyer settings */}
        {!isSeller && (
          <section className="glass-neon rounded-2xl p-6 space-y-4">
            <h2 className="font-display tracking-wider text-primary-glow">BECOME A SELLER</h2>
            <p className="text-sm text-muted-foreground">Apply to list your own cards. Admin will review your request.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Telegram</label>
                <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@yourhandle" className="bg-input/60 mt-1" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Jabber / OTR</label>
                <Input value={jabber} onChange={(e) => setJabber(e.target.value)} placeholder="you@xmpp.org" className="bg-input/60 mt-1" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Expected daily volume</label>
                <Input value={expectedVolume} onChange={(e) => setExpectedVolume(e.target.value)} placeholder="e.g. 500 cards / day" className="bg-input/60 mt-1" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sample BINs</label>
                <Input value={sampleBins} onChange={(e) => setSampleBins(e.target.value)} placeholder="411111, 545454" className="bg-input/60 mt-1" />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Why should we approve you?</label>
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us about your sources, refund policy, experience…" className="bg-input/60 mt-1" />
            </div>
            <Button onClick={applySeller} className="bg-gradient-primary shadow-neon">
              <Send className="h-4 w-4 mr-2" />Submit application
            </Button>
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
          <Button onClick={() => { clearToken(); window.location.href = "/auth"; }} variant="outline" className="w-full mt-2">
            <Plus className="h-3 w-3 mr-1" />Sign in with another account
          </Button>
        </section>
      </div>
    </AppShell>
  );
};

export default Settings;
