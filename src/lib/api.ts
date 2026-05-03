/**
 * VPS API client — all backend calls go through here.
 * No Supabase, no Lovable Cloud. Pure VPS.
 */

export const AUTH_CHANGED_EVENT = "cruzercc-auth-changed";

export function resolveApiBase(): string {
  const envBase = import.meta.env.VITE_API_BASE as string | undefined;
  if (envBase && envBase.length > 0) return envBase.replace(/\/+$/, "");

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    const host = hostname.toLowerCase();

    if (host === "cruzercc.shop" || host === "www.cruzercc.shop") {
      return `${origin.replace(/\/+$/, "")}/api`;
    }

    // When running from Lovable preview, point at the VPS
    if (host.endsWith("lovable.app") || host.endsWith("lovableproject.com")) {
      return "https://cruzercc.shop/api";
    }

    return `${origin.replace(/\/+$/, "")}/api`;
  }

  return "/api";
}

export const API_BASE = resolveApiBase();

export function buildApiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

// ── Token helpers ──
const TOKEN_KEY = "cruzercc.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
}

export function decodeToken(t: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(t.split(".")[1]));
  } catch {
    return null;
  }
}

// ── API Error ──
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ── Generic fetch wrapper ──
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T = unknown>(
  method: Method,
  path: string,
  body?: unknown,
  opts?: { params?: Record<string, string | number | boolean | undefined> },
): Promise<T> {
  let url = buildApiUrl(path);
  if (opts?.params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Network error — is the server running?");
  }

  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    let msg = `HTTP ${res.status}`;
    if (ct.includes("application/json")) {
      try {
        const j = await res.json();
        msg = j.error ?? j.message ?? msg;
      } catch { /* keep generic */ }
    } else {
      msg = `Server returned non-JSON response (HTTP ${res.status})`;
    }
    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Convenience verbs ──
export const api = {
  get: <T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>("GET", path, undefined, { params }),
  post: <T = unknown>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T = unknown>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T = unknown>(path: string) => request<T>("DELETE", path),
};

// ── Typed API helpers ──

export interface AuthResult {
  token: string;
  user: { id: string; email: string; username: string; role: string };
}

export const authApi = {
  signup: (data: { email: string; username: string; password: string }) =>
    api.post<AuthResult>("/auth/signup", data),
  login: (data: { identifier: string; password: string }) =>
    api.post<AuthResult>("/auth/login", data),
  sellerLogin: (data: { identifier: string; password: string }) =>
    api.post<AuthResult>("/auth/seller-login", data),
  adminLogin: (data: { identifier: string; password: string }) =>
    api.post<AuthResult>("/auth/admin-login", data),
  me: () => api.get<{ user: AuthResult["user"] }>("/auth/me"),
};

export interface VpsProfile {
  id: string;
  email: string;
  username: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  balance: number;
}

export const profileApi = {
  get: () => api.get<{ profile: VpsProfile }>("/profile"),
  update: (data: { display_name?: string; bio?: string; country?: string; avatar_url?: string }) =>
    api.patch<{ ok: true }>("/profile", data),
};
