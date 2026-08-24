import { useQuery } from "@tanstack/react-query";
import { Activity, Server, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";

export default function AdminConsolePage() {
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: api.admin.users });
  const workspacesQuery = useQuery({ queryKey: ["admin-workspaces"], queryFn: api.admin.workspaces });
  const healthQuery = useQuery({ queryKey: ["admin-health"], queryFn: api.admin.systemHealth, refetchInterval: 30_000 });

  const health = healthQuery.data;

  return (
    <AppShell active="admin" title="Admin">
      <section className="pika-dash-summary pika-page-block">
        <article><span className="summary-icon coral"><Activity size={17} /></span><div><small>Database</small><b>{health?.database ?? "…"}</b></div><em>Live</em></article>
        <article><span className="summary-icon violet"><Activity size={17} /></span><div><small>Redis</small><b>{health?.redis ?? "…"}</b></div><em>Live</em></article>
        <article><span className="summary-icon orange"><Activity size={17} /></span><div><small>Celery workers online</small><b>{health?.celery_workers_online ?? "…"}</b></div><em>Live</em></article>
      </section>

      <section className="pika-dash-summary pika-page-block">
        <article><span className="summary-icon coral"><Users size={17} /></span><div><small>Total users</small><b>{health?.total_users ?? "…"}</b></div><em>All time</em></article>
        <article><span className="summary-icon violet"><Server size={17} /></span><div><small>Total workspaces</small><b>{health?.total_workspaces ?? "…"}</b></div><em>All time</em></article>
        <article><span className="summary-icon orange"><Server size={17} /></span><div><small>Active connections</small><b>{health?.total_active_connections ?? "…"}</b></div><em>Right now</em></article>
      </section>

      <section className="pika-conversations-table pika-page-block">
        <div className="pika-table-head"><div><span>Workspaces</span><p>Plan, membership, and usage across every tenant.</p></div></div>
        <div className="pika-table-rows">
          {(workspacesQuery.data ?? []).map((ws) => (
            <article key={ws.id}>
              <div className="table-conversation"><span className="pika-result-mark violet">{ws.name.charAt(0).toUpperCase()}</span><span><b>{ws.name}</b><small>{ws.member_count} member(s) · {ws.connection_count} connection(s) · {ws.monitor_count} monitor(s)</small></span></div>
              <span className="table-topic">{ws.plan}</span>
              <span className="table-source">{new Date(ws.created_at).toLocaleDateString()}</span>
              <span />
            </article>
          ))}
        </div>
      </section>

      <section className="pika-conversations-table pika-page-block">
        <div className="pika-table-head"><div><span>Users</span><p>Every Pika account on this server.</p></div></div>
        <div className="pika-table-rows">
          {(usersQuery.data ?? []).map((user) => (
            <article key={user.id}>
              <div className="table-conversation"><span className="pika-result-mark orange">{user.email.charAt(0).toUpperCase()}</span><span><b>{user.email}</b><small>{user.display_name ?? "No display name"}</small></span></div>
              <span className="table-topic">{user.status}</span>
              <span className="table-source">{user.is_staff ? "Staff" : "Member"}</span>
              <span />
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
