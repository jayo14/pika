// Typed client for the Pika FastAPI backend. Every call sends cookies (session auth is
// an HttpOnly cookie, never a token the browser can read) and talks to `/api/v1/*`,
// which the Vite dev server proxies to the backend (see vite.config.ts) so requests are
// same-origin in local development. Set VITE_API_BASE_URL for a split deployment where
// the client and API are on different origins (the backend's PIKA_CORS_ORIGINS must then
// include the client's origin).

const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1`;

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (response.status === 204) return undefined as T;

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const detail = body && typeof body === "object" && "detail" in body ? String(body.detail) : response.statusText;
    throw new ApiError(response.status, detail || "Request failed.");
  }

  return body as T;
}

const get = <T,>(path: string) => request<T>(path);
const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const put = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined });
const patch = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
const del = <T,>(path: string) => request<T>(path, { method: "DELETE" });

// ---- Types (mirrors api/app/schemas.py) ----

export type User = { id: string; email: string; display_name: string | null; status: string; is_staff: boolean; created_at: string };
export type Workspace = { id: string; name: string; owner_user_id: string; retention_days: number; created_at: string };
export type WorkspaceMembership = Workspace & { role: "owner" | "member" };
export type SessionResponse = { user: User; workspaces: WorkspaceMembership[] };

export type DiscordConnection = {
  id: string;
  workspace_id: string;
  discord_guild_id: string;
  discord_guild_name: string | null;
  status: "pending" | "active" | "revoked" | "error";
  granted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};
export type ConnectionChannel = { id: string; connection_id: string; discord_channel_id: string; mode: "allow" | "deny" };

export type Monitor = {
  id: string;
  workspace_id: string;
  connection_id: string;
  name: string;
  monitor_type: string;
  priority: "low" | "normal" | "high" | "critical";
  enabled: boolean;
  created_at: string;
};

export type Signal = {
  id: string;
  workspace_id: string;
  event_id: string;
  monitor_id: string;
  kind: string;
  score: number;
  explanation: { reasons: { field: string; operator: string; value: string; description: string }[]; rule_count?: number; matched_count?: number };
  status: "new" | "saved" | "archived";
  created_at: string;
};

export type SavedItem = { id: string; workspace_id: string; signal_id: string; saved_by_user_id: string; status: string; note: string | null; created_at: string };

export type NotificationItem = { id: string; workspace_id: string; signal_id: string; priority: string; delivered_at: string | null; read_at: string | null; created_at: string };
export type NotificationPreference = { workspace_id: string; min_priority: "low" | "normal" | "high" | "critical"; in_app_enabled: boolean };

export type SearchResultItem = { event_id: string; connection_id: string; event_type: string; occurred_at: string; snippet: string; rank: number };
export type SearchResponse = { id: string; query: string; results: SearchResultItem[] };
export type SavedSearch = { id: string; workspace_id: string; query_text: string; saved: boolean; created_at: string };

export type PlanLimits = { plan: string; monitors: number | null; connections: number | null; saved_searches: number | null; retention_days: number; price_usd_per_month: number };
export type Subscription = { workspace_id: string; plan: string; status: string; current_period_end: string | null };
export type Usage = { workspace_id: string; plan: string; limits: PlanLimits; monitors_used: number; connections_used: number; saved_searches_used: number };

export type AdminUser = { id: string; email: string; display_name: string | null; status: string; is_staff: boolean; created_at: string };
export type AdminUserList = { items: AdminUser[]; total: number };
export type AdminUserWorkspaceMembership = { workspace_id: string; workspace_name: string; role: string };
export type AdminUserDetail = AdminUser & { workspaces: AdminUserWorkspaceMembership[] };

export type AdminWorkspace = { id: string; name: string; owner_user_id: string; retention_days: number; created_at: string; plan: string; member_count: number; connection_count: number; monitor_count: number };
export type AdminWorkspaceList = { items: AdminWorkspace[]; total: number };
export type AdminWorkspaceMember = { user_id: string; email: string; role: string };
export type AdminWorkspaceConnection = { id: string; discord_guild_id: string; discord_guild_name: string | null; status: string };
export type AdminWorkspaceMonitor = { id: string; name: string; monitor_type: string; enabled: boolean };
export type AdminWorkspaceDetail = AdminWorkspace & { members: AdminWorkspaceMember[]; connections: AdminWorkspaceConnection[]; monitors: AdminWorkspaceMonitor[] };

export type AdminSystemHealth = { database: "ok" | "error"; redis: "ok" | "error"; celery_workers_online: number; total_users: number; total_workspaces: number; total_active_connections: number; events_pending_expiry_next_24h: number };

// ---- API surface ----

export const api = {
  auth: {
    me: () => get<SessionResponse>("/auth/me"),
    signup: (body: { email: string; password: string; display_name?: string; workspace_name?: string }) =>
      post<SessionResponse>("/auth/signup", body),
    signin: (body: { email: string; password: string }) => post<SessionResponse>("/auth/signin", body),
    signout: () => post<void>("/auth/signout"),
    updateProfile: (body: { display_name?: string }) => patch<SessionResponse>("/auth/me", body),
    changePassword: (body: { current_password: string; new_password: string }) =>
      post<void>("/auth/change-password", body),
    requestPasswordReset: (email: string) => post<{ message: string }>("/auth/password-reset/request", { email }),
    confirmPasswordReset: (token: string, new_password: string) =>
      post<void>("/auth/password-reset/confirm", { token, new_password }),
  },
  workspaces: {
    list: () => get<Workspace[]>("/workspaces"),
    create: (body: { name: string; retention_days?: number }) => post<Workspace>("/workspaces", body),
  },
  discord: {
    oauthStart: (workspace_id: string) => post<{ authorize_url: string }>("/discord/oauth/start", { workspace_id }),
    connections: (workspace_id: string) => get<DiscordConnection[]>(`/connections?workspace_id=${workspace_id}`),
    revoke: (connectionId: string) => post<DiscordConnection>(`/connections/${connectionId}/revoke`),
    channels: (connectionId: string) => get<ConnectionChannel[]>(`/connections/${connectionId}/channels`),
    setChannels: (connectionId: string, channels: { discord_channel_id: string; mode: "allow" | "deny" }[]) =>
      put<ConnectionChannel[]>(`/connections/${connectionId}/channels`, channels),
  },
  monitors: {
    list: (workspace_id: string) => get<Monitor[]>(`/monitors?workspace_id=${workspace_id}`),
    create: (body: { workspace_id: string; connection_id: string; name: string; monitor_type: string; priority?: string; keyword: string }) =>
      post<Monitor>("/monitors", body),
    update: (id: string, body: Partial<{ name: string; priority: string; enabled: boolean }>) => patch<Monitor>(`/monitors/${id}`, body),
    remove: (id: string) => del<void>(`/monitors/${id}`),
  },
  signals: {
    list: (workspace_id: string, status?: string) => get<Signal[]>(`/signals?workspace_id=${workspace_id}${status ? `&status=${status}` : ""}`),
    save: (id: string) => post<SavedItem>(`/signals/${id}/save`),
    updateStatus: (id: string, status: string) => patch<Signal>(`/signals/${id}`, { status }),
  },
  savedItems: {
    list: (workspace_id: string) => get<SavedItem[]>(`/saved-items?workspace_id=${workspace_id}`),
    update: (id: string, body: Partial<{ status: string; note: string }>) => patch<SavedItem>(`/saved-items/${id}`, body),
  },
  notifications: {
    list: (workspace_id: string, unreadOnly = false) => get<NotificationItem[]>(`/notifications?workspace_id=${workspace_id}&unread_only=${unreadOnly}`),
    markRead: (id: string) => patch<NotificationItem>(`/notifications/${id}/read`),
    getPreference: (workspace_id: string) => get<NotificationPreference>(`/notification-preferences?workspace_id=${workspace_id}`),
    setPreference: (workspace_id: string, body: { min_priority: string; in_app_enabled: boolean }) =>
      put<NotificationPreference>(`/notification-preferences?workspace_id=${workspace_id}`, body),
  },
  search: {
    run: (workspace_id: string, query: string, save = false) => post<SearchResponse>("/search", { workspace_id, query, save }),
    history: (workspace_id: string, savedOnly = false) => get<SavedSearch[]>(`/searches?workspace_id=${workspace_id}&saved_only=${savedOnly}`),
    save: (id: string) => post<SavedSearch>(`/searches/${id}/save`),
  },
  billing: {
    subscription: (workspace_id: string) => get<Subscription>(`/billing/subscription?workspace_id=${workspace_id}`),
    usage: (workspace_id: string) => get<Usage>(`/billing/usage?workspace_id=${workspace_id}`),
    changePlan: (workspace_id: string, plan: string) => post<Subscription>(`/billing/plan?workspace_id=${workspace_id}`, { plan }),
  },
  admin: {
    users: (params: { limit?: number; offset?: number; q?: string } = {}) => {
      const search = new URLSearchParams();
      if (params.limit) search.set("limit", String(params.limit));
      if (params.offset) search.set("offset", String(params.offset));
      if (params.q) search.set("q", params.q);
      return get<AdminUserList>(`/admin/users?${search.toString()}`);
    },
    userDetail: (id: string) => get<AdminUserDetail>(`/admin/users/${id}`),
    workspaces: (params: { limit?: number; offset?: number; q?: string } = {}) => {
      const search = new URLSearchParams();
      if (params.limit) search.set("limit", String(params.limit));
      if (params.offset) search.set("offset", String(params.offset));
      if (params.q) search.set("q", params.q);
      return get<AdminWorkspaceList>(`/admin/workspaces?${search.toString()}`);
    },
    workspaceDetail: (id: string) => get<AdminWorkspaceDetail>(`/admin/workspaces/${id}`),
    systemHealth: () => get<AdminSystemHealth>("/admin/system-health"),
  },
};
