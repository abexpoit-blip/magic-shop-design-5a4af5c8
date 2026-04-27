import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const Settings = () => {
  const { user, profile, refresh, roles } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [shopName, setShopName] = useState("");
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");
  const [pwd, setPwd] = useState("");

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
      </div>
    </AppShell>
  );
};

export default Settings;
