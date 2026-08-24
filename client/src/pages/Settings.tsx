import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CreditCard, Plug, Trash2, User as UserIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, api, type ConnectionChannel } from "@/lib/api";

type Tab = "integrations" | "notifications" | "billing" | "account";

function readInitialTab(): Tab {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  return tab === "notifications" || tab === "billing" || tab === "account" ? tab : "integrations";
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>(readInitialTab);
  const [discordStatus, setDiscordStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("discord_status");
    if (status) {
      setDiscordStatus(status);
      window.history.replaceState({}, "", "/settings?tab=integrations");
    }
  }, []);

  const TABS: { id: Tab; label: string; icon: typeof Plug }[] = [
    { id: "integrations", label: "Integrations", icon: Plug },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "account", label: "Account", icon: UserIcon },
  ];

  return (
    <AppShell active="settings" title="Settings">
      <div className="pika-settings-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return <button key={t.id} className={tab === t.id ? "is-active" : ""} onClick={() => setTab(t.id)}><Icon size={15} />{t.label}</button>;
        })}
      </div>

      {discordStatus && (
        <div className={`pika-banner ${discordStatus === "connected" ? "pika-banner-success" : "pika-banner-error"}`}>
          {discordStatus === "connected" && "Discord server connected."}
          {discordStatus === "error" && "Could not connect to Discord. Please try again."}
          {discordStatus === "expired" && "That connection link expired. Please try again."}
        </div>
      )}

      {tab === "integrations" && <IntegrationsTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "billing" && <BillingTab />}
      {tab === "account" && <AccountTab />}
    </AppShell>
  );
}

function IntegrationsTab() {
  const { activeWorkspaceId, isWorkspaceOwner } = useAuth();
  const workspaceId = activeWorkspaceId ?? "";
  const queryClient = useQueryClient();
  const [editingChannels, setEditingChannels] = useState<string | null>(null);

  const connectionsQuery = useQuery({ queryKey: ["connections", workspaceId], queryFn: () => api.discord.connections(workspaceId), enabled: Boolean(workspaceId) });

  const connectMutation = useMutation({
    mutationFn: () => api.discord.oauthStart(workspaceId),
    onSuccess: (data) => { window.location.href = data.authorize_url; },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.discord.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connections", workspaceId] }),
  });

  const connections = connectionsQuery.data ?? [];

  return (
    <section className="pika-conversations-table pika-page-block">
      <div className="pika-table-head">
        <div><span>Connected Discord servers</span><p>Pika only processes activity from servers an administrator explicitly authorized here.</p></div>
        {isWorkspaceOwner && <button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>{connectMutation.isPending ? "Redirecting…" : "Connect a server"}</button>}
      </div>
      {!isWorkspaceOwner && <p className="pika-form-hint pika-form-error-inline">Only the workspace owner can connect or revoke servers and edit channel scope.</p>}
      {connectMutation.error && <p className="pika-form-error pika-form-error-inline">{connectMutation.error instanceof ApiError ? connectMutation.error.detail : "Could not start Discord connection."}</p>}
      {!connections.length ? (
        <div className="pika-table-empty"><Plug size={20} /><b>No servers connected yet.</b><span>Connect a Discord server you administer to start monitoring it.</span></div>
      ) : (
        <div className="pika-table-rows">
          {connections.map((connection) => (
            <article key={connection.id}>
              <div className="table-conversation"><span className="pika-result-mark violet"><Plug size={14} /></span><span><b>{connection.discord_guild_name ?? connection.discord_guild_id}</b><small>Guild {connection.discord_guild_id}</small></span></div>
              <span className={`table-relevance relevance-${connection.status === "active" ? "high" : "worth-a-look"}`}>{connection.status}</span>
              <button className="pika-icon-button" onClick={() => setEditingChannels(editingChannels === connection.id ? null : connection.id)} disabled={!isWorkspaceOwner}>Channels</button>
              <button className="pika-icon-button" aria-label="Revoke connection" onClick={() => revokeMutation.mutate(connection.id)} disabled={!isWorkspaceOwner || connection.status !== "active"}><Trash2 size={15} /></button>
            </article>
          ))}
        </div>
      )}
      {editingChannels && isWorkspaceOwner && <ChannelAllowlistEditor connectionId={editingChannels} />}
    </section>
  );
}

function ChannelAllowlistEditor({ connectionId }: { connectionId: string }) {
  const queryClient = useQueryClient();
  const channelsQuery = useQuery({ queryKey: ["connection-channels", connectionId], queryFn: () => api.discord.channels(connectionId) });
  const [newChannelId, setNewChannelId] = useState("");

  const saveMutation = useMutation({
    mutationFn: (channels: ConnectionChannel[]) => api.discord.setChannels(connectionId, channels.map((c) => ({ discord_channel_id: c.discord_channel_id, mode: c.mode }))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connection-channels", connectionId] }),
  });

  const channels = channelsQuery.data ?? [];

  const addChannel = () => {
    if (!newChannelId.trim()) return;
    saveMutation.mutate([...channels, { id: "", connection_id: connectionId, discord_channel_id: newChannelId.trim(), mode: "allow" }]);
    setNewChannelId("");
  };
  const removeChannel = (id: string) => saveMutation.mutate(channels.filter((c) => c.discord_channel_id !== id));

  return (
    <div className="pika-channel-editor">
      <p>Explicit channel allowlist — Pika only reads channel IDs listed here as "allow".</p>
      <div className="pika-form-row">
        <input placeholder="Discord channel ID" value={newChannelId} onChange={(e) => setNewChannelId(e.target.value)} />
        <button type="button" onClick={addChannel} disabled={saveMutation.isPending}>Add</button>
      </div>
      <ul className="pika-channel-list">
        {channels.map((c) => <li key={c.discord_channel_id}><span>{c.discord_channel_id}</span><em>{c.mode}</em><button type="button" onClick={() => removeChannel(c.discord_channel_id)}>Remove</button></li>)}
        {!channels.length && <li className="pika-empty-inline">No channels allowed yet.</li>}
      </ul>
    </div>
  );
}

function NotificationsTab() {
  const { activeWorkspaceId } = useAuth();
  const workspaceId = activeWorkspaceId ?? "";
  const queryClient = useQueryClient();

  const prefQuery = useQuery({ queryKey: ["notification-preference", workspaceId], queryFn: () => api.notifications.getPreference(workspaceId), enabled: Boolean(workspaceId) });
  const saveMutation = useMutation({
    mutationFn: (body: { min_priority: string; in_app_enabled: boolean }) => api.notifications.setPreference(workspaceId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-preference", workspaceId] }),
  });

  const [minPriority, setMinPriority] = useState("low");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (prefQuery.data) {
      setMinPriority(prefQuery.data.min_priority);
      setEnabled(prefQuery.data.in_app_enabled);
    }
  }, [prefQuery.data]);

  return (
    <section className="pika-conversations-table pika-page-block">
      <div className="pika-table-head"><div><span>Notification preferences</span><p>Pika is selective by default — a monitor only re-notifies after a cooldown window, and this controls what you see at all.</p></div></div>
      <form className="pika-form" onSubmit={(e) => { e.preventDefault(); saveMutation.mutate({ min_priority: minPriority, in_app_enabled: enabled }); }}>
        <div className="pika-form-row">
          <label>Minimum priority to show
            <select value={minPriority} onChange={(e) => setMinPriority(e.target.value)}>
              <option value="low">Low and above</option>
              <option value="normal">Normal and above</option>
              <option value="high">High and above</option>
              <option value="critical">Critical only</option>
            </select>
          </label>
          <label className="pika-switch pika-switch-inline">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span>In-app notifications enabled</span>
          </label>
        </div>
        <button className="pika-form-submit" type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving…" : "Save preferences"}</button>
      </form>
    </section>
  );
}

function BillingTab() {
  const { activeWorkspaceId, isWorkspaceOwner } = useAuth();
  const workspaceId = activeWorkspaceId ?? "";
  const queryClient = useQueryClient();

  const usageQuery = useQuery({ queryKey: ["billing-usage", workspaceId], queryFn: () => api.billing.usage(workspaceId), enabled: Boolean(workspaceId) });
  const changePlanMutation = useMutation({
    mutationFn: (plan: string) => api.billing.changePlan(workspaceId, plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-usage", workspaceId] });
    },
  });

  const usage = usageQuery.data;
  const plans = [
    { id: "free", label: "Free", price: "$0", blurb: "3 monitors, 1 connected server, 7-day retention." },
    { id: "pro", label: "Pro", price: "$29/mo", blurb: "25 monitors, 5 connected servers, 30-day retention." },
    { id: "business", label: "Business", price: "$99/mo", blurb: "Unlimited monitors and servers, 90-day retention." },
  ];

  return (
    <section className="pika-conversations-table pika-page-block">
      <div className="pika-table-head"><div><span>Billing</span><p>Plan limits are enforced by the API — this is not a UI-only display.</p></div></div>
      {!isWorkspaceOwner && <p className="pika-form-hint pika-form-error-inline">Only the workspace owner can change the plan.</p>}
      {usage && (
        <div className="pika-usage-row">
          <div><small>Plan</small><b>{usage.plan}</b></div>
          <div><small>Monitors</small><b>{usage.monitors_used}{usage.limits.monitors !== null ? ` / ${usage.limits.monitors}` : ""}</b></div>
          <div><small>Connected servers</small><b>{usage.connections_used}{usage.limits.connections !== null ? ` / ${usage.limits.connections}` : ""}</b></div>
          <div><small>Saved searches</small><b>{usage.saved_searches_used}{usage.limits.saved_searches !== null ? ` / ${usage.limits.saved_searches}` : ""}</b></div>
        </div>
      )}
      <div className="pika-plan-grid">
        {plans.map((plan) => (
          <div key={plan.id} className={`pika-plan-card ${usage?.plan === plan.id ? "is-current" : ""}`}>
            <span className="pika-plan-name">{plan.label}</span>
            <span className="pika-plan-price">{plan.price}</span>
            <p>{plan.blurb}</p>
            <button disabled={!isWorkspaceOwner || usage?.plan === plan.id || changePlanMutation.isPending} onClick={() => changePlanMutation.mutate(plan.id)}>
              {usage?.plan === plan.id ? "Current plan" : `Switch to ${plan.label}`}
            </button>
          </div>
        ))}
      </div>
      {changePlanMutation.error && (
        <p className="pika-form-error pika-form-error-inline">
          {changePlanMutation.error instanceof ApiError ? changePlanMutation.error.detail : "Could not change plan."}
        </p>
      )}
    </section>
  );
}

function AccountTab() {
  const { user, workspaces, activeWorkspaceId } = useAuth();
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);

  return (
    <>
      <section className="pika-conversations-table pika-page-block">
        <div className="pika-table-head"><div><span>Account</span><p>Your Pika identity and active workspace.</p></div></div>
        <div className="pika-account-details">
          <div><small>Email</small><b>{user?.email}</b></div>
          <div><small>Active workspace</small><b>{workspace?.name ?? "—"}</b></div>
          <div><small>Your role</small><b>{workspace?.role ?? "—"}</b></div>
          <div><small>Data retention</small><b>{workspace?.retention_days ?? "—"} days</b></div>
        </div>
      </section>
      <ProfileForm />
      <ChangePasswordForm />
    </>
  );
}

function ProfileForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(user?.display_name ?? "");
  }, [user?.display_name]);

  const mutation = useMutation({
    mutationFn: () => api.auth.updateProfile({ display_name: displayName || undefined }),
    onSuccess: (data) => {
      queryClient.setQueryData(["me"], data);
      setSaved(true);
    },
  });

  return (
    <section className="pika-conversations-table pika-page-block">
      <div className="pika-table-head"><div><span>Profile</span><p>Shown in the sidebar and topbar.</p></div></div>
      <form
        className="pika-form"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          mutation.mutate();
        }}
      >
        <div className="pika-form-row">
          <label>Display name<input value={displayName} onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }} placeholder="Your name" maxLength={120} /></label>
        </div>
        {mutation.error && <p className="pika-form-error">{mutation.error instanceof ApiError ? mutation.error.detail : "Could not update profile."}</p>}
        {saved && !mutation.error && <p className="pika-form-hint">Saved.</p>}
        <button className="pika-form-submit" type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save profile"}</button>
      </form>
    </section>
  );
}

function ChangePasswordForm() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.auth.changePassword({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      // Changing the password revokes every session, including this one (see
      // api/app/routers/auth.py change_password) — the cookie is already cleared
      // server-side, so this just resets local state and sends the user to sign in.
      queryClient.setQueryData(["me"], null);
      queryClient.clear();
      setLocation("/sign-in");
    },
  });

  return (
    <section className="pika-conversations-table pika-page-block">
      <div className="pika-table-head"><div><span>Change password</span><p>You'll be signed out everywhere and need to sign in again with the new password.</p></div></div>
      <form
        className="pika-form"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="pika-form-row">
          <label>Current password<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" /></label>
          <label>New password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={10} autoComplete="new-password" /></label>
        </div>
        {mutation.error && <p className="pika-form-error">{mutation.error instanceof ApiError ? mutation.error.detail : "Could not change password."}</p>}
        <button className="pika-form-submit" type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Updating…" : "Change password"}</button>
      </form>
    </section>
  );
}
