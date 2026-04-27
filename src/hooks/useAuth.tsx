import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getActiveRole, setActiveRole as persistActiveRole, clearActiveRole, type ActiveRole } from "@/lib/activeRole";

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
  /** Which mode the user is operating in (buyer/seller). Honors the user's
   *  pick at login for accounts that hold multiple roles. */
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => void;
  loading: boolean;
  /** True when profile load failed or timed out. UI should show error + retry. */
  profileError: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Hard ceiling for profile load. After this we stop showing skeletons and
// flip into an error state so the navbar never spins forever.
const PROFILE_LOAD_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number, label = "timeout"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState<ActiveRole>("buyer");

  const [profileError, setProfileError] = useState<string | null>(null);

  // Track which user id we last loaded for, so a TOKEN_REFRESHED event for the
  // same user does not trigger a redundant profile reload.
  const loadedForUid = useRef<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const loadProfile = async (uid: string, email?: string | null) => {
    // De-dupe concurrent loads for the same uid
    if (loadedForUid.current === uid && inFlight.current) return inFlight.current;

    setProfileError(null);

    const fetchAll = Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);

    const run = (async () => {
      const [{ data: p }, { data: r }] = await withTimeout(
        fetchAll,
        PROFILE_LOAD_TIMEOUT_MS,
        "profile-load-timeout",
      );

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

      // Anti-auto-switch: if the persisted activeRole is "seller" but this
      // account doesn't actually carry the seller/admin role, fall back to
      // "buyer" — and conversely, if the user IS a seller but no choice was
      // ever stored, pin them to "seller" so a stale buyer default can't
      // silently downgrade an active seller session.
      const isSeller = userRoles.includes("seller") || userRoles.includes("admin");
      const stored = getActiveRole(uid);
      if (stored === "seller" && !isSeller) {
        setActiveRoleState("buyer");
        clearActiveRole();
      } else if (!stored && isSeller) {
        setActiveRoleState("seller");
        persistActiveRole(uid, "seller");
      }

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
    })()
      .catch((err: unknown) => {
        // Profile load failed or timed out. Surface a friendly error so the
        // navbar can swap skeletons for a retry chip instead of spinning.
        const msg =
          err instanceof Error && err.message === "profile-load-timeout"
            ? "Profile took too long to load"
            : err instanceof Error
            ? err.message
            : "Couldn't load profile";
        setProfileError(msg);
        // Re-throw so callers can also catch if they want.
        throw err;
      })
      .finally(() => {
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
        setActiveRoleState("buyer");
        clearActiveRole();
        loadedForUid.current = null;
        setLoading(false);
        return;
      }

      // Restore the user's chosen mode (buyer/seller) from localStorage.
      const stored = getActiveRole(sess.user.id);
      if (stored) setActiveRoleState(stored);

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
        loadProfile(uid, email).catch(() => {
          // Already handled inside loadProfile (sets profileError + loading=false).
        });
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
    clearActiveRole();
    await supabase.auth.signOut();
  };

  const setActiveRole = (role: ActiveRole) => {
    if (user) persistActiveRole(user.id, role);
    setActiveRoleState(role);
  };

  return (
    <Ctx.Provider value={{ user, session, profile, roles, activeRole, setActiveRole, loading, profileError, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
