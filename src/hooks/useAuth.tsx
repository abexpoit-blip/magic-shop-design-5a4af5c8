import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { getActiveRole, setActiveRole as persistActiveRole, clearActiveRole, type ActiveRole } from "@/lib/activeRole";
import { getToken, clearToken, AUTH_CHANGED_EVENT, decodeToken, profileApi } from "@/lib/api";

type Role = "admin" | "seller" | "user" | "buyer";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  balance: number;
  is_seller: boolean;
  seller_status: string | null;
  banned: boolean;
  commission_percent?: number;
  is_seller_visible?: boolean;
  is_seller_verified?: boolean;
}

/** Minimal user object (replaces Supabase User) */
export interface AppUser {
  id: string;
  email: string;
  username: string;
}

interface AuthCtx {
  user: AppUser | null;
  session: null;        // kept for compat — always null
  profile: Profile | null;
  roles: Role[];
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => void;
  loading: boolean;
  profileError: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

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
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState<ActiveRole>("buyer");
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadedForUid = useRef<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const loadProfile = useCallback(async (skipCache = false) => {
    const token = getToken();
    if (!token) {
      setUser(null); setProfile(null); setRoles([]);
      setActiveRoleState("buyer"); clearActiveRole();
      loadedForUid.current = null;
      setLoading(false);
      return;
    }

    setLoading(true);

    // Decode token for basic user info
    const decoded = decodeToken(token);
    if (!decoded?.sub) {
      clearToken();
      setUser(null); setProfile(null); setRoles([]);
      setLoading(false);
      return;
    }

    const uid = decoded.sub as string;
    if (!skipCache && loadedForUid.current === uid && inFlight.current) return inFlight.current;

    setProfileError(null);

    const run = (async () => {
      const { profile: p } = await withTimeout(profileApi.get(), PROFILE_LOAD_TIMEOUT_MS, "profile-load-timeout");

      const userRoles = (p.roles ?? []) as Role[];
      const appUser: AppUser = { id: p.id, email: p.email, username: p.username };
      const prof: Profile = {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        balance: Number(p.balance ?? 0),
        is_seller: userRoles.includes("seller"),
        seller_status: userRoles.includes("seller") ? "approved" : null,
        banned: false,
      };

      setUser(appUser);
      setProfile(prof);
      setRoles(userRoles);
      loadedForUid.current = uid;

      const isSeller = userRoles.includes("seller") || userRoles.includes("admin");
      const stored = getActiveRole(uid);
      if (stored === "seller" && !isSeller) {
        setActiveRoleState("buyer"); clearActiveRole();
      } else if (isSeller) {
        setActiveRoleState("seller"); persistActiveRole(uid, "seller");
      } else {
        setActiveRoleState("buyer");
      }

      // Save account for switcher
      try {
        const { saveAccount } = await import("@/lib/accountSwitcher");
        const role = userRoles.includes("admin") ? "admin"
          : userRoles.includes("seller") ? "seller" : "user";
        saveAccount({ email: p.email, username: p.username, role, savedAt: Date.now() });
      } catch { /* ignore */ }
    })()
      .catch((err: unknown) => {
        const msg =
          err instanceof Error && err.message === "profile-load-timeout"
            ? "Profile took too long to load"
            : err instanceof Error
            ? err.message
            : "Couldn't load profile";
        setProfileError(msg);
        // If it's an auth error (401), clear token
        if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 401) {
          clearToken();
          setUser(null); setProfile(null); setRoles([]);
        }
      })
      .finally(() => {
        inFlight.current = null;
        setLoading(false);
      });

    inFlight.current = run;
    return run;
  }, []);

  useEffect(() => {
    loadProfile();
    // Listen for token changes across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cruzercc.token") {
        loadedForUid.current = null;
        loadProfile();
      }
    };
    const onAuthChanged = () => {
      loadedForUid.current = null;
      loadProfile(true);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, [loadProfile]);

  const refresh = async () => {
    loadedForUid.current = null;
    await loadProfile(true);
  };

  const signOut = async () => {
    clearActiveRole();
    clearToken();
    setUser(null);
    setProfile(null);
    setRoles([]);
    setActiveRoleState("buyer");
    loadedForUid.current = null;
  };

  const setActiveRole = (role: ActiveRole) => {
    if (user) persistActiveRole(user.id, role);
    setActiveRoleState(role);
  };

  return (
    <Ctx.Provider value={{ user, session: null, profile, roles, activeRole, setActiveRole, loading, profileError, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
