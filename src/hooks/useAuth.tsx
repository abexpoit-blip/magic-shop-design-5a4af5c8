import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { getToken, clearToken, AUTH_CHANGED_EVENT, decodeToken, profileApi, VpsProfile } from "@/lib/api";

export interface AppUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  balance: number;
  role: string;
  is_seller: boolean;
  banned: boolean;
}

interface AuthCtx {
  user: AppUser | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const loadedForUid = useRef<string | null>(null);

  const loadProfile = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setProfile(null);
      loadedForUid.current = null;
      setLoading(false);
      return;
    }

    const decoded = decodeToken(token);
    if (!decoded?.sub) {
      clearToken();
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const uid = decoded.sub as string;
    if (loadedForUid.current === uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setProfileError(null);

    try {
      const { profile: p } = await profileApi.get();
      const appUser: AppUser = { id: p.id, email: p.email, username: p.username, role: p.role };
      const prof: Profile = {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        balance: Number(p.balance ?? 0),
        role: p.role,
        is_seller: p.role === "seller" || p.role === "admin",
        banned: false,
      };
      setUser(appUser);
      setProfile(prof);
      loadedForUid.current = uid;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't load profile";
      setProfileError(msg);
      if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 401) {
        clearToken();
        setUser(null);
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cruzercc.token") {
        loadedForUid.current = null;
        loadProfile();
      }
    };
    const onAuthChanged = () => {
      loadedForUid.current = null;
      loadProfile();
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
    await loadProfile();
  };

  const signOut = async () => {
    clearToken();
    setUser(null);
    setProfile(null);
    loadedForUid.current = null;
  };

  return (
    <Ctx.Provider value={{ user, profile, loading, profileError, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
