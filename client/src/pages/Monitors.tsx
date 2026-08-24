import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Radar, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, api } from "@/lib/api";

const MONITOR_TYPES = ["opportunity", "problem", "intent", "recommendation", "competitor", "trend", "community"];
const PRIORITIES = ["low", "normal", "high", "critical"] as const;

export default function MonitorsPage() {
  const { activeWorkspaceId } = useAuth();
  const workspaceId = activeWorkspaceId ?? "";
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const connectionsQuery = useQuery({
    queryKey: ["connections", workspaceId],
    queryFn: () => api.discord.connections(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const monitorsQuery = useQuery({
    queryKey: ["monitors", workspaceId],
    queryFn: () => api.monitors.list(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const [name, setName] = useState("");
  const [monitorType, setMonitorType] = useState(MONITOR_TYPES[0]);
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("normal");
  const [connectionId, setConnectionId] = useState("");
  const [keyword, setKeyword] = useState("");

  const createMutation = useMutation({
    mutationFn: () => api.monitors.create({ workspace_id: workspaceId, connection_id: connectionId, name, monitor_type: monitorType, priority, keyword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors", workspaceId] });
      setName("");
      setKeyword("");
      setFormOpen(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.monitors.update(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["monitors", workspaceId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.monitors.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["monitors", workspaceId] }),
  });

  const connections = connectionsQuery.data ?? [];
  const monitors = monitorsQuery.data ?? [];

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!connectionId) return;
    createMutation.mutate();
  };

  return (
    <AppShell active="monitors" title="Monitors">
      <section className="pika-conversations-table pika-page-block">
        <div className="pika-table-head">
          <div><span>Your monitors</span><p>Pika evaluates every authorized event against these rules and creates an explainable signal on a match.</p></div>
          <button onClick={() => setFormOpen((open) => !open)}><Plus size={15} />New monitor</button>
        </div>

        {formOpen && (
          <form className="pika-form" onSubmit={submit}>
            {!connections.length ? (
              <p className="pika-form-hint">Connect a Discord server in Settings → Integrations before creating a monitor.</p>
            ) : (
              <>
                <div className="pika-form-row">
                  <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="React developer requests" /></label>
                  <label>Keyword<input value={keyword} onChange={(e) => setKeyword(e.target.value)} required placeholder="react developer" /></label>
                </div>
                <div className="pika-form-row">
                  <label>Connected server
                    <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)} required>
                      <option value="" disabled>Choose a server</option>
                      {connections.map((c) => <option key={c.id} value={c.id}>{c.discord_guild_name ?? c.discord_guild_id}</option>)}
                    </select>
                  </label>
                  <label>Signal type
                    <select value={monitorType} onChange={(e) => setMonitorType(e.target.value)}>
                      {MONITOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label>Priority
                    <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                </div>
                {createMutation.error && <p className="pika-form-error">{createMutation.error instanceof ApiError ? createMutation.error.detail : "Could not create monitor."}</p>}
                <button className="pika-form-submit" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating…" : "Create monitor"}</button>
              </>
            )}
          </form>
        )}

        {!monitors.length ? (
          <div className="pika-table-empty"><Radar size={20} /><b>No monitors yet.</b><span>Create one to start catching opportunities automatically.</span></div>
        ) : (
          <div className="pika-table-rows pika-monitor-rows">
            {monitors.map((monitor) => (
              <article key={monitor.id}>
                <div className="table-conversation"><span className="pika-result-mark violet"><Radar size={14} /></span><span><b>{monitor.name}</b><small>{monitor.monitor_type} · priority {monitor.priority}</small></span></div>
                <span className="table-source">{connections.find((c) => c.id === monitor.connection_id)?.discord_guild_name ?? "—"}</span>
                <label className="pika-switch">
                  <input type="checkbox" checked={monitor.enabled} onChange={(e) => toggleMutation.mutate({ id: monitor.id, enabled: e.target.checked })} />
                  <span>{monitor.enabled ? "Enabled" : "Paused"}</span>
                </label>
                <button className="pika-icon-button" aria-label={`Delete ${monitor.name}`} onClick={() => deleteMutation.mutate(monitor.id)}><Trash2 size={15} /></button>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
