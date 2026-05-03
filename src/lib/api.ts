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
  contentType: string;
  bodySnippet: string;
  constructor(status: number, message: string, contentType = "", bodySnippet = "") {
    super(message);
    this.status = status;
    this.contentType = contentType;
    this.bodySnippet = bodySnippet;
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

  const ct = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    const rawBody = await res.text();
    let msg = `HTTP ${res.status}`;
    if (ct.includes("application/json")) {
      try {
        const j = JSON.parse(rawBody);
        msg = j.error ?? j.message ?? msg;
      } catch { /* keep generic */ }
    } else if (ct.includes("text/html")) {
      msg = `Server returned HTML instead of JSON (HTTP ${res.status})`;
    }
    throw new ApiError(res.status, msg, ct, rawBody.slice(0, 300));
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
  user: { id: string; email: string; username: string; role: string; roles?: string[] };
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
  id: string; email: string; username: string; role: string;
  display_name: string | null; avatar_url: string | null;
  bio: string | null; country: string | null;
  balance: number; roles?: string[];
}

export const profileApi = {
  get: () => api.get<{ profile: VpsProfile }>("/profile"),
  update: (data: { display_name?: string; bio?: string; country?: string; avatar_url?: string }) =>
    api.patch<{ ok: true }>("/profile", data),
};

// Cards
export interface VpsCard {
  id: string; bin: string; brand: string; country: string; state?: string;
  zip?: string; price: number; status: string; created_at: string;
  last4?: string; level?: string; type?: string; bank?: string;
  exp_month?: number | string; exp_year?: number | string;
  city?: string; base?: string; refundable?: boolean;
  has_phone?: boolean; has_email?: boolean; email?: string;
  seller_id?: string; sold_at?: string;
}

export const cardsApi = {
  browse: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get<{ cards: VpsCard[] }>("/cards", params),
  mine: () => api.get<{ cards: VpsCard[] }>("/cards/mine"),
  create: (data: Record<string, unknown>) => api.post<{ id: string }>("/cards", data),
  bulkCreate: (rows: Record<string, unknown>[]) => api.post<{ count: number }>("/cards/bulk", rows),
  del: (id: string) => api.del<{ ok: true }>(`/cards/${id}`),
  reveal: (id: string) => api.get<{ card: Record<string, unknown> }>(`/cards/${id}/reveal`),
  update: (id: string, data: Record<string, unknown>) => api.patch<{ ok: true }>(`/cards/${id}`, data),
  bulkUpdate: (ids: string[], data: Record<string, unknown>) =>
    api.post<{ ok: true }>("/cards/bulk-update", { ids, ...data }),
  bulkDelete: (ids: string[]) => api.post<{ ok: true }>("/cards/bulk-delete", { ids }),
};

export const cartApi = {
  list: () => api.get<{ items: Array<{ id: string; card_id: string; card?: Record<string, unknown> }> }>("/cart"),
  add: (card_id: string) => api.post<{ ok: true }>("/cart", { card_id }),
  addBatch: (card_ids: string[]) => api.post<{ ok: true }>("/cart/batch", { card_ids }),
  remove: (item_id: string) => api.del<{ ok: true }>(`/cart/${item_id}`),
  checkout: (card_ids: string[]) =>
    api.post<{ order_id: string; total: number }>("/cart/checkout", { card_ids }),
};

export interface VpsOrder {
  id: string; total: number; status: string; created_at: string;
  items?: Array<{ card_id: string; price: number; brand?: string; bin?: string; last4?: string; country?: string }>;
}

export const ordersApi = {
  mine: () => api.get<{ orders: VpsOrder[] }>("/orders/mine"),
  all: () => api.get<{ orders: VpsOrder[] }>("/orders"),
};

export const walletApi = {
  balance: () => api.get<{ balance: number }>("/wallet"),
  transactions: () => api.get<{ transactions: Array<Record<string, unknown>> }>("/wallet/transactions"),
};

export const depositsApi = {
  submit: (data: { amount: number; method: string; proof_url?: string; note?: string }) =>
    api.post<{ deposit: Record<string, unknown> }>("/deposits", data),
  mine: () => api.get<{ deposits: Array<Record<string, unknown>> }>("/deposits/mine"),
  all: (status?: string) => api.get<{ deposits: Array<Record<string, unknown>> }>("/deposits", { status }),
  approve: (id: string, admin_notes?: string) =>
    api.post<{ deposit: Record<string, unknown> }>(`/deposits/${id}/approve`, { admin_notes }),
  reject: (id: string, admin_notes?: string) =>
    api.post<{ deposit: Record<string, unknown> }>(`/deposits/${id}/reject`, { admin_notes }),
};

export const payoutsApi = {
  request: (data: { amount: number; method: string; destination: string }) =>
    api.post<{ payout: Record<string, unknown> }>("/payouts", data),
  mine: () => api.get<{ payouts: Array<Record<string, unknown>> }>("/payouts/mine"),
  all: (status?: string) => api.get<{ payouts: Array<Record<string, unknown>> }>("/payouts", { status }),
  complete: (id: string, admin_notes?: string) =>
    api.post<{ payout: Record<string, unknown> }>(`/payouts/${id}/complete`, { admin_notes }),
  reject: (id: string, admin_notes?: string) =>
    api.post<{ payout: Record<string, unknown> }>(`/payouts/${id}/reject`, { admin_notes }),
};

export const ticketsApi = {
  create: (data: { subject: string; body: string }) =>
    api.post<{ ticket: Record<string, unknown> }>("/tickets", data),
  mine: () => api.get<{ tickets: Array<Record<string, unknown>> }>("/tickets/mine"),
  messages: (id: string) => api.get<{ messages: Array<Record<string, unknown>> }>(`/tickets/${id}/messages`),
  reply: (id: string, body: string) => api.post<{ ok: true }>(`/tickets/${id}/reply`, { body }),
  all: (status?: string) => api.get<{ tickets: Array<Record<string, unknown>> }>("/tickets", { status }),
  close: (id: string) => api.post<{ ok: true }>(`/tickets/${id}/close`),
};

export const sellerAppsApi = {
  submit: (data: Record<string, unknown>) =>
    api.post<{ application: Record<string, unknown> }>("/seller-applications", data),
  mine: () => api.get<{ applications: Array<Record<string, unknown>> }>("/seller-applications/mine"),
  all: (status?: string) =>
    api.get<{ applications: Array<Record<string, unknown>> }>("/seller-applications", { status }),
  approve: (id: string, admin_notes?: string) =>
    api.post<{ application: Record<string, unknown> }>(`/seller-applications/${id}/approve`, { admin_notes }),
  reject: (id: string, admin_notes?: string) =>
    api.post<{ application: Record<string, unknown> }>(`/seller-applications/${id}/reject`, { admin_notes }),
};

export const announcementsApi = {
  list: () => api.get<{ announcements: Array<Record<string, unknown>> }>("/announcements"),
  create: (data: { title: string; body: string }) =>
    api.post<{ announcement: Record<string, unknown> }>("/announcements", data),
  del: (id: string) => api.del<{ ok: true }>(`/announcements/${id}`),
};

export const adminApi = {
  users: (q?: string) => api.get<{ users: Array<Record<string, unknown>> }>("/admin/users", { q }),
  stats: () => api.get<Record<string, number>>("/admin/stats"),
  updateProfile: (id: string, data: Record<string, unknown>) =>
    api.patch<{ ok: true }>(`/admin/users/${id}/profile`, data),
  adjustBalance: (id: string, delta: number) =>
    api.post<{ ok: true }>(`/admin/users/${id}/balance`, { delta }),
  toggleBan: (id: string) => api.post<{ ok: true }>(`/admin/users/${id}/toggle-ban`),
  revokeSeller: (id: string) => api.post<{ ok: true }>(`/admin/users/${id}/revoke-seller`),
  changePassword: (password: string) =>
    api.post<{ ok: true }>("/admin/change-password", { password }),
};

export const siteSettingsApi = {
  get: () => api.get<{ settings: Record<string, unknown> }>("/site-settings"),
  update: (data: Record<string, unknown>) =>
    api.put<{ ok: true }>("/site-settings", data),
};

export const depositAddressesApi = {
  list: () => api.get<{ addresses: Array<Record<string, unknown>> }>("/deposit-addresses"),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<{ ok: true }>(`/deposit-addresses/${id}`, data),
  create: (data: Record<string, unknown>) =>
    api.post<{ address: Record<string, unknown> }>("/deposit-addresses", data),
};

export const newsApi = {
  list: () => api.get<{ updates: Array<Record<string, unknown>> }>("/news"),
};

export const priceRulesApi = {
  mine: () => api.get<{ rules: Array<Record<string, unknown>> }>("/price-rules/mine"),
  create: (data: Record<string, unknown>) =>
    api.post<{ rule: Record<string, unknown> }>("/price-rules", data),
  del: (id: string) => api.del<{ ok: true }>(`/price-rules/${id}`),
};

export const refundsApi = {
  create: (data: Record<string, unknown>) =>
    api.post<{ refund: Record<string, unknown> }>("/refunds", data),
  mine: () => api.get<{ refunds: Array<Record<string, unknown>> }>("/refunds/mine"),
  all: (status?: string) => api.get<{ refunds: Array<Record<string, unknown>> }>("/refunds", { status }),
  decide: (id: string, approve: boolean, note?: string) =>
    api.post<{ ok: true }>(`/refunds/${id}/${approve ? "approve" : "reject"}`, { resolution_note: note }),
};

export const appNotesApi = {
  list: (applicationId: string) =>
    api.get<{ notes: Array<Record<string, unknown>> }>(`/seller-applications/${applicationId}/notes`),
  create: (applicationId: string, note: string) =>
    api.post<{ note: Record<string, unknown> }>(`/seller-applications/${applicationId}/notes`, { note }),
  del: (applicationId: string, noteId: string) =>
    api.del<{ ok: true }>(`/seller-applications/${applicationId}/notes/${noteId}`),
};

export const sellersApi = {
  visible: () => api.get<{ sellers: Array<Record<string, unknown>> }>("/sellers/visible"),
  profile: (id: string) => api.get<{ profile: Record<string, unknown> }>(`/sellers/${id}`),
  cards: (id: string, params?: Record<string, string | number | boolean | undefined>) =>
    api.get<{ cards: VpsCard[]; count: number }>(`/sellers/${id}/cards`, params),
};
