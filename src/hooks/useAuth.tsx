import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
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

  // Track which user id we last loaded for, so a TOKEN_REFRESHED event for the
  // same user does not trigger a redundant profile reload.
  const loadedForUid = useRef<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const loadProfile = async (uid: string, email?: string | null) => {
    // De-dupe concurrent loads for the same uid
    if (loadedForUid.current === uid && inFlight.current) return inFlight.current;

    const run = (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);

      let prof = p as Profile | null;
      const userRoles = ((r as { role: Role }[] | null) ?? []).map((x) => x.role);

      // FIX: if no profile row exists yet (new signup, or row never inserted),
      // create one so the UI doesn't sit forever on the skeleton placeholder.
      if (!prof) {
        const fallbackUsername =
          (email?.split("@")[0] ?? "user").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) ||
          `user_${uid.slice(0, 8)}`;
        const { data: created } = await supabase
          .from("profiles")
          .insert({ id: uid, username: fallbackUsername, balance: 0 })
          .select("*")
          .maybeSingle();
        prof = (created as Profile | null) ?? {
          id: uid,
          username: fallbackUsername,
          display_name: null,
          avatar_url: null,
          balance: 0,
          is_seller: false,
          seller_status: null,
          banned: false,
        };
      }

      setProfile(prof);
      setRoles(userRoles);
      loadedForUid.current = uid;

      if (prof && email && !prof.banned) {
        try {
          const { saveAccount } = await import("@/lib/accountSwitcher");
          const role = userRoles.includes("admin")
            ? "admin"
            : userRoles.includes("seller")
            ? "seller"
            : "user";
          saveAccount({ email, username: prof.username, role, savedAt: Date.now() });
        } catch {
          /* ignore */
        }
      }
    })().finally(() => {
      inFlight.current = null;
      setLoading(false);
    });

    inFlight.current = run;
    return run;
  };

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately on subscribe, so we
    // do NOT also call getSession() — that was triggering two parallel profile
    // loads on every mount (the source of the laggy first paint).
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);

      if (!sess?.user) {
        setProfile(null);
        setRoles([]);
        loadedForUid.current = null;
        setLoading(false);
        return;
      }

      // Skip refetch on token refresh for the same user — the JWT changed
      // but profile/roles did not.
      if (event === "TOKEN_REFRESHED" && loadedForUid.current === sess.user.id) {
        setLoading(false);
        return;
      }

      // Defer to avoid running supabase calls inside the auth callback (their
      // own guidance — prevents potential deadlocks on the auth lock).
      const uid = sess.user.id;
      const email = sess.user.email;
      setTimeout(() => {
        loadProfile(uid, email).catch(() => setLoading(false));
      }, 0);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (user) {
      loadedForUid.current = null; // force reload
      await loadProfile(user.id, user.email);
    }
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
