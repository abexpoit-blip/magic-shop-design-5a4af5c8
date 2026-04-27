import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "seller" | "user";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  balance: number;
  is_seller: boolean;
  seller_status: string | null;
  banned: boolean;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: Role[];
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string, email?: string | null) => {
    setLoading(true);
    try {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      const prof = p as Profile | null;
      const userRoles = ((r as { role: Role }[] | null) ?? []).map((x) => x.role);
      setProfile(prof);
      setRoles(userRoles);
      // Auto-save account for switcher (only if not banned)
      if (prof && email && !prof.banned) {
        try {
          const { saveAccount } = await import("@/lib/accountSwitcher");
          const role = userRoles.includes("admin") ? "admin" : userRoles.includes("seller") ? "seller" : "user";
          saveAccount({ email, username: prof.username, role, savedAt: Date.now() });
        } catch { /* ignore */ }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setLoading(true);
        setTimeout(() => loadProfile(sess.user.id, sess.user.email), 0);
      } else {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadProfile(sess.user.id, sess.user.email).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (user) await loadProfile(user.id, user.email);
  };
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user, session, profile, roles, loading, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
